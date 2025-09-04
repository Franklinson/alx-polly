"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { deletePoll } from "@/app/lib/actions/poll-actions";
import { isAdmin, getCurrentUser } from "@/app/lib/actions/auth-actions";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Poll {
  id: string;
  question: string;
  user_id: string;
  created_at: string;
  options: string[];
}

export default function AdminPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        toast.error("Please login to continue");
        router.push("/login");
        return;
      }

      const hasAdminAccess = await isAdmin(user.id);
      if (!hasAdminAccess) {
        toast.error("Access denied. Admin privileges required.");
        router.push("/polls");
        return;
      }

      setIsAuthorized(true);
      fetchAllPolls();
    } catch (error) {
      console.error("Auth check failed:", error);
      toast.error("Authorization check failed");
      router.push("/polls");
    } finally {
      setCheckingAuth(false);
    }
  };

  const fetchAllPolls = async () => {
    try {
      const supabase = createClient();

      // Only fetch if user is admin (double-check)
      const user = await getCurrentUser();
      const hasAdminAccess = await isAdmin(user?.id);

      if (!hasAdminAccess) {
        toast.error("Unauthorized access attempt");
        router.push("/polls");
        return;
      }

      const { data, error } = await supabase
        .from("polls")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to fetch polls");
        console.error("Fetch error:", error);
        return;
      }

      if (data) {
        setPolls(data);
      }
    } catch (error) {
      toast.error("Failed to load admin data");
      console.error("Admin fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (pollId: string) => {
    // Confirm admin status before deletion
    try {
      const user = await getCurrentUser();
      const hasAdminAccess = await isAdmin(user?.id);

      if (!hasAdminAccess) {
        toast.error("Admin privileges required for this action");
        return;
      }

      if (
        !confirm(
          "Are you sure you want to delete this poll? This action cannot be undone.",
        )
      ) {
        return;
      }

      setDeleteLoading(pollId);
      const result = await deletePoll(pollId);

      if (result.error) {
        toast.error(`Failed to delete poll: ${result.error}`);
      } else {
        setPolls(polls.filter((poll) => poll.id !== pollId));
        toast.success("Poll deleted successfully");
      }
    } catch (error) {
      toast.error("Delete operation failed");
      console.error("Delete error:", error);
    } finally {
      setDeleteLoading(null);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page.
          </p>
          <Button onClick={() => router.push("/polls")}>Return to Polls</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-red-600">🔒 Admin Panel</h1>
        <p className="text-gray-600 mt-2">
          Manage all polls in the system. Use with caution.
        </p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-4">
          <p className="text-sm text-yellow-800">
            ⚠️ <strong>Admin Access:</strong> You can view and delete any poll.
            Actions are logged and irreversible.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {polls.map((poll) => (
          <Card key={poll.id} className="border-l-4 border-l-red-500">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg break-words">
                    {/* Sanitize the question display */}
                    {poll.question.substring(0, 200)}
                    {poll.question.length > 200 && "..."}
                  </CardTitle>
                  <CardDescription>
                    <div className="space-y-1 mt-2">
                      <div className="text-xs">
                        Poll ID:{" "}
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                          {poll.id.substring(0, 8)}...
                        </code>
                      </div>
                      <div className="text-xs">
                        Owner ID:{" "}
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                          {poll.user_id.substring(0, 8)}...
                        </code>
                      </div>
                      <div className="text-xs">
                        Created:{" "}
                        {new Date(poll.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </CardDescription>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(poll.id)}
                  disabled={deleteLoading === poll.id}
                  className="ml-4"
                >
                  {deleteLoading === poll.id ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <h4 className="font-medium">
                  Options ({poll.options.length}):
                </h4>
                <ul className="list-disc list-inside space-y-1 max-h-32 overflow-y-auto">
                  {poll.options.map((option, index) => (
                    <li
                      key={index}
                      className="text-gray-700 text-sm break-words"
                    >
                      {/* Sanitize option display */}
                      {option.substring(0, 100)}
                      {option.length > 100 && "..."}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {polls.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          <p>No polls found in the system.</p>
        </div>
      )}

      {/* Admin actions */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2">Admin Actions</h3>
        <div className="flex gap-2 text-sm text-gray-600">
          <span>Total Polls: {polls.length}</span>
          <span>•</span>
          <span>Last Updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
