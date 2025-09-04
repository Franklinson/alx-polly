import { getPollById } from "@/app/lib/actions/poll-actions";
import { getCurrentUser } from "@/app/lib/actions/auth-actions";
import { notFound, redirect } from "next/navigation";
// Import the client component
import EditPollForm from "./EditPollForm";

export default async function EditPollPage({
  params,
}: {
  params: { id: string };
}) {
  // Validate poll ID format
  if (!params.id || typeof params.id !== "string" || params.id.length < 10) {
    notFound();
  }

  // Get current user first
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Get poll data
  const { poll, error } = await getPollById(params.id);

  if (error || !poll) {
    notFound();
  }

  // Check ownership - user can only edit their own polls
  if (poll.user_id !== user.id) {
    // Redirect to polls page with error indication
    redirect("/polls?error=unauthorized");
  }

  return (
    <div className="max-w-md mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Edit Poll</h1>
        <p className="text-gray-600 text-sm">
          Make changes to your poll. Note that editing a poll with existing
          votes may affect results.
        </p>
      </div>

      {/* Security notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-6">
        <p className="text-sm text-yellow-800">
          ⚠️ <strong>Notice:</strong> You can only edit polls that you created.
        </p>
      </div>

      <EditPollForm poll={poll} />
    </div>
  );
}
