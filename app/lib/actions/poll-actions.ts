"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Input validation and sanitization utilities
const MAX_QUESTION_LENGTH = 500;
const MAX_OPTION_LENGTH = 200;
const MAX_OPTIONS = 10;
const MIN_OPTIONS = 2;

function sanitizeInput(input: string): string {
  if (typeof input !== "string") return "";

  // Remove HTML tags and potentially dangerous characters
  return input
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/[<>'"&]/g, (char) => {
      const entities: { [key: string]: string } = {
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
        "&": "&amp;",
      };
      return entities[char] || char;
    })
    .trim();
}

function validatePollInput(question: string, options: string[]): string | null {
  // Validate question
  if (!question || question.trim().length === 0) {
    return "Question is required";
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return `Question must be ${MAX_QUESTION_LENGTH} characters or less`;
  }

  // Check for suspicious patterns
  if (/<script|javascript:|data:/i.test(question)) {
    return "Question contains invalid content";
  }

  // Validate options
  if (!Array.isArray(options) || options.length < MIN_OPTIONS) {
    return `At least ${MIN_OPTIONS} options are required`;
  }

  if (options.length > MAX_OPTIONS) {
    return `Maximum ${MAX_OPTIONS} options allowed`;
  }

  // Validate each option
  for (let i = 0; i < options.length; i++) {
    const option = options[i];

    if (!option || option.trim().length === 0) {
      return `Option ${i + 1} cannot be empty`;
    }

    if (option.length > MAX_OPTION_LENGTH) {
      return `Option ${i + 1} must be ${MAX_OPTION_LENGTH} characters or less`;
    }

    if (/<script|javascript:|data:/i.test(option)) {
      return `Option ${i + 1} contains invalid content`;
    }
  }

  // Check for duplicate options
  const uniqueOptions = new Set(options.map((opt) => opt.toLowerCase().trim()));
  if (uniqueOptions.size !== options.length) {
    return "All options must be unique";
  }

  return null;
}

// CREATE POLL
export async function createPoll(formData: FormData) {
  const supabase = await createClient();

  const rawQuestion = formData.get("question") as string;
  const rawOptions = formData.getAll("options").filter(Boolean) as string[];

  // Validate input
  const validationError = validatePollInput(rawQuestion, rawOptions);
  if (validationError) {
    return { error: validationError };
  }

  // Sanitize inputs
  const question = sanitizeInput(rawQuestion);
  const options = rawOptions.map((option) => sanitizeInput(option));

  // Get user from session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: userError.message };
  }
  if (!user) {
    return { error: "You must be logged in to create a poll." };
  }

  const { error } = await supabase.from("polls").insert([
    {
      user_id: user.id,
      question,
      options,
    },
  ]);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/polls");
  return { error: null };
}

// GET USER POLLS
export async function getUserPolls() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { polls: [], error: "Not authenticated" };

  const { data, error } = await supabase
    .from("polls")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { polls: [], error: error.message };
  return { polls: data ?? [], error: null };
}

// GET POLL BY ID
export async function getPollById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("polls")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { poll: null, error: error.message };
  return { poll: data, error: null };
}

// SUBMIT VOTE
export async function submitVote(pollId: string, optionIndex: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Validate pollId format (should be UUID)
  if (!pollId || typeof pollId !== "string" || pollId.length < 10) {
    return { error: "Invalid poll ID" };
  }

  // Validate optionIndex
  if (
    typeof optionIndex !== "number" ||
    optionIndex < 0 ||
    !Number.isInteger(optionIndex)
  ) {
    return { error: "Invalid option selection" };
  }

  // Get poll data to validate option bounds
  const { data: pollData, error: pollError } = await supabase
    .from("polls")
    .select("options, id")
    .eq("id", pollId)
    .single();

  if (pollError || !pollData) {
    return { error: "Poll not found" };
  }

  // Validate option index is within bounds
  if (optionIndex >= pollData.options.length) {
    return { error: "Invalid option selected" };
  }

  // Check for existing vote from this user/session
  const voteQuery = supabase.from("votes").select("id").eq("poll_id", pollId);

  if (user?.id) {
    voteQuery.eq("user_id", user.id);
  } else {
    // For anonymous users, we'll track by IP or session (basic prevention)
    // This requires additional session tracking but provides basic protection
    return { error: "Please log in to vote" };
  }

  const { data: existingVote } = await voteQuery.single();

  if (existingVote) {
    return { error: "You have already voted on this poll" };
  }

  // Rate limiting check (simple timestamp-based)
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
  const { data: recentVotes } = await supabase
    .from("votes")
    .select("id")
    .eq("user_id", user?.id)
    .gte("created_at", oneMinuteAgo);

  if (recentVotes && recentVotes.length >= 5) {
    return { error: "Too many votes. Please wait a moment." };
  }

  // Insert the vote
  const { error } = await supabase.from("votes").insert([
    {
      poll_id: pollId,
      user_id: user?.id ?? null,
      option_index: optionIndex,
    },
  ]);

  if (error) {
    console.error("Vote submission error:", error);
    return { error: "Failed to submit vote. Please try again." };
  }

  return { error: null };
}

// DELETE POLL
export async function deletePoll(id: string) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return { error: "Authentication failed" };
  }

  if (!user) {
    return { error: "You must be logged in to delete a poll" };
  }

  // Check if user is admin or owns the poll
  const { data: pollData, error: fetchError } = await supabase
    .from("polls")
    .select("user_id")
    .eq("id", id)
    .single();

  if (fetchError) {
    return { error: "Poll not found" };
  }

  // Check if user owns the poll
  if (pollData.user_id !== user.id) {
    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return { error: "You can only delete your own polls" };
    }
  }

  // Delete the poll with ownership verification
  const { error } = await supabase.from("polls").delete().eq("id", id);

  if (error) return { error: "Failed to delete poll" };
  revalidatePath("/polls");
  return { error: null };
}

// UPDATE POLL
export async function updatePoll(pollId: string, formData: FormData) {
  const supabase = await createClient();

  const rawQuestion = formData.get("question") as string;
  const rawOptions = formData.getAll("options").filter(Boolean) as string[];

  // Validate pollId format
  if (!pollId || typeof pollId !== "string" || pollId.length < 10) {
    return { error: "Invalid poll ID" };
  }

  // Validate input
  const validationError = validatePollInput(rawQuestion, rawOptions);
  if (validationError) {
    return { error: validationError };
  }

  // Sanitize inputs
  const question = sanitizeInput(rawQuestion);
  const options = rawOptions.map((option) => sanitizeInput(option));

  // Get user from session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: userError.message };
  }
  if (!user) {
    return { error: "You must be logged in to update a poll." };
  }

  // Only allow updating polls owned by the user
  const { error } = await supabase
    .from("polls")
    .update({ question, options })
    .eq("id", pollId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}
