"use server";

import { createClient } from "@/lib/supabase/server";
import { LoginFormData, RegisterFormData } from "../types";

// Admin role management
export async function isAdmin(userId?: string): Promise<boolean> {
  if (!userId) return false;

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .single();

  return !!data;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  const isUserAdmin = await isAdmin(user.id);
  if (!isUserAdmin) {
    throw new Error("Admin access required");
  }
  return user;
}

// Password validation utilities
function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters long";
  }

  if (password.length > 128) {
    return "Password must be less than 128 characters";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }

  if (!/\d/.test(password)) {
    return "Password must contain at least one number";
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return "Password must contain at least one special character";
  }

  // Check for common weak passwords
  const commonPasswords = [
    "password",
    "123456",
    "12345678",
    "qwerty",
    "abc123",
    "password123",
    "admin",
    "letmein",
    "welcome",
    "monkey",
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    return "This password is too common. Please choose a stronger password";
  }

  return null;
}

function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function login(data: LoginFormData) {
  const supabase = await createClient();

  // Sanitize input
  const email = sanitizeEmail(data.email);

  // Basic email validation
  if (!email || !email.includes("@") || email.length > 254) {
    return { error: "Please enter a valid email address" };
  }

  if (!data.password) {
    return { error: "Password is required" };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: email,
    password: data.password,
  });

  if (error) {
    // Don't expose specific login errors to prevent user enumeration
    if (error.message.includes("Invalid login credentials")) {
      return { error: "Invalid email or password" };
    }
    return { error: "Login failed. Please try again." };
  }

  // Success: no error
  return { error: null };
}

export async function register(data: RegisterFormData) {
  const supabase = await createClient();

  // Validate and sanitize inputs
  const email = sanitizeEmail(data.email);

  if (!email || !email.includes("@") || email.length > 254) {
    return { error: "Please enter a valid email address" };
  }

  if (!data.name || data.name.trim().length === 0) {
    return { error: "Name is required" };
  }

  if (data.name.length > 100) {
    return { error: "Name must be less than 100 characters" };
  }

  // Sanitize name (remove potential XSS)
  const name = data.name.trim().replace(/<[^>]*>/g, "");

  // Validate password strength
  const passwordError = validatePassword(data.password);
  if (passwordError) {
    return { error: passwordError };
  }

  const { error } = await supabase.auth.signUp({
    email: email,
    password: data.password,
    options: {
      data: {
        name: name,
      },
    },
  });

  if (error) {
    // Don't expose specific registration errors
    if (error.message.includes("already registered")) {
      return { error: "An account with this email already exists" };
    }
    return { error: "Registration failed. Please try again." };
  }

  // Success: no error
  return { error: null };
}

export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Logout error:", error);
    return { error: "Logout failed. Please try again." };
  }
  return { error: null };
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}
