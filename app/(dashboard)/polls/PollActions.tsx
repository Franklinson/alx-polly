"use client";

import Link from "next/link";
import { useAuth } from "@/app/lib/context/auth-context";
import { Button } from "@/components/ui/button";
import { deletePoll } from "@/app/lib/actions/poll-actions";

interface Poll {
  id: string;
  question: string;
  options: any[];
  user_id: string;
}

interface PollActionsProps {
  poll: Poll;
}

export default function PollActions({ poll }: PollActionsProps) {
  const { user } = useAuth();
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async () => {
    if (deleteLoading) return; // Prevent double-clicks

    if (
      confirm(
        "Are you sure you want to delete this poll? This action cannot be undone.",
      )
    ) {
      setDeleteLoading(true);
      try {
        const result = await deletePoll(poll.id);
        if (result.error) {
          alert(`Failed to delete poll: ${result.error}`);
        } else {
          // Poll deleted successfully - reload the page
          window.location.reload();
        }
      } catch (error) {
        console.error("Delete error:", error);
        alert("An error occurred while deleting the poll. Please try again.");
      } finally {
        setDeleteLoading(false);
      }
    }
  };

  return (
    <div className="border rounded-md shadow-md hover:shadow-lg transition-shadow bg-white">
      <Link href={`/polls/${poll.id}`}>
        <div className="group p-4">
          <div className="h-full">
            <div>
              <h2 className="group-hover:text-blue-600 transition-colors font-bold text-lg">
                {poll.question}
              </h2>
              <p className="text-slate-500">{poll.options.length} options</p>
            </div>
          </div>
        </div>
      </Link>
      {user && user.id === poll.user_id && (
        <div className="flex gap-2 p-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/polls/${poll.id}/edit`}>Edit</Link>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteLoading}
          >
            {deleteLoading ? "Deleting..." : "Delete"}
          </Button>
        </div>
      )}
    </div>
  );
}
