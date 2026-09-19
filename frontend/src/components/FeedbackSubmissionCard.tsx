"use client";

import { useEffect, useState, FormEvent, useId } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { EligibleSession, SessionFeedback } from "@/lib/types";
import DashboardCard from "./DashboardCard";

interface FeedbackSubmissionCardProps {
  onFeedbackSubmitted?: (newFeedback: SessionFeedback) => void;
  onSubmissionRollback?: (tempId: number) => void;
}

export default function FeedbackSubmissionCard({
  onFeedbackSubmitted,
  onSubmissionRollback,
}: FeedbackSubmissionCardProps) {
  const { user } = useAuth();

  const isParent = user?.role === "parent";
  const [selectedStudentId, setSelectedStudentId] = useState<number | undefined>(
    isParent ? user?.family_links?.[0]?.student : user?.id
  );

  const [eligibleSessions, setEligibleSessions] = useState<EligibleSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | "">("");
  const [ratingClarity, setRatingClarity] = useState<number>(0);
  const [ratingEngagement, setRatingEngagement] = useState<number>(0);
  const [ratingPace, setRatingPace] = useState<number>(0);
  const [note, setNote] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastSubmittedTitle, setLastSubmittedTitle] = useState<string>("");
  const [showSuccessState, setShowSuccessState] = useState(false);

  const resetFormToEmptyState = () => {
    setSelectedSessionId("");
    setRatingClarity(0);
    setRatingEngagement(0);
    setRatingPace(0);
    setNote("");
    setErrorMessage("");
    setShowSuccessState(false);
  };

  // Auto-dismiss success indicator automatically in 8 seconds
  useEffect(() => {
    if (showSuccessState) {
      const timer = setTimeout(() => {
        resetFormToEmptyState();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessState]);

  const studentSelectId = useId();
  const sessionSelectId = useId();
  const noteInputId = useId();

  // Sync selected student if family_links load after initial mount
  useEffect(() => {
    if (isParent && user?.family_links && user.family_links.length > 0) {
      if (!selectedStudentId || selectedStudentId === user.id) {
        setSelectedStudentId(user.family_links[0].student);
      }
    }
  }, [isParent, user?.family_links, selectedStudentId, user?.id]);

  // Load eligible sessions whenever selectedStudent changes
  useEffect(() => {
    if (!user) return;
    if (isParent && (!selectedStudentId || selectedStudentId === user.id)) {
      if (user.family_links && user.family_links.length > 0) {
        setSelectedStudentId(user.family_links[0].student);
      }
      return;
    }

    const targetStudentId = isParent ? selectedStudentId : user.id;
    if (!targetStudentId) return;

    setLoadingSessions(true);
    setErrorMessage("");
    const url = isParent
      ? `/feedback/eligible-sessions/?student_id=${targetStudentId}`
      : "/feedback/eligible-sessions/";

    api
      .get<EligibleSession[]>(url)
      .then((sessions) => {
        setEligibleSessions(sessions);
        if (sessions.length > 0) {
          setSelectedSessionId(sessions[0].id);
        } else {
          setSelectedSessionId("");
        }
      })
      .catch(() => {
        setErrorMessage("Could not load eligible sessions.");
      })
      .finally(() => setLoadingSessions(false));
  }, [user, isParent, selectedStudentId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId || !user) return;
    if (!ratingClarity || !ratingEngagement || !ratingPace) {
      setErrorMessage("Please select star ratings (1–5) for all 3 dimensions.");
      return;
    }

    setErrorMessage("");
    setShowSuccessState(false);
    setSubmitting(true);

    const targetStudentId = isParent ? selectedStudentId : user.id;
    const selectedSession = eligibleSessions.find(
      (s) => s.id === selectedSessionId
    );

    // Create optimistic record with temporary negative ID
    const tempId = -Date.now();
    const optimisticFeedback: SessionFeedback = {
      id: tempId,
      session: Number(selectedSessionId),
      session_detail: {
        id: Number(selectedSessionId),
        class_obj: selectedSession?.class_obj || 0,
        class_name: selectedSession?.class_name || "Debate Session",
        instructor_display: {
          id: 0,
          display_name: selectedSession?.instructor_name || "Instructor",
          role: "instructor",
        },
        scheduled_date: selectedSession?.scheduled_date || new Date().toISOString(),
        status: "completed",
        duration_minutes: selectedSession?.duration_minutes || 60,
        topic: selectedSession?.topic || "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      student: targetStudentId || user.id,
      student_display: {
        id: targetStudentId || user.id,
        display_name:
          isParent && user.family_links
            ? user.family_links.find((l) => l.student === targetStudentId)
                ?.student_display.display_name || user.display_name
            : user.display_name,
        role: "student",
      },
      submitter: user.id,
      submitter_display: {
        id: user.id,
        display_name: user.display_name,
        role: user.role,
      },
      rating_clarity: ratingClarity,
      rating_engagement: ratingEngagement,
      rating_pace: ratingPace,
      note,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Trigger optimistic UI update
    onFeedbackSubmitted?.(optimisticFeedback);

    // Also remove from eligible sessions optimistically
    const prevSessions = [...eligibleSessions];
    setEligibleSessions((prev) => prev.filter((s) => s.id !== selectedSessionId));

    try {
      const payload: Record<string, unknown> = {
        session: Number(selectedSessionId),
        rating_clarity: ratingClarity,
        rating_engagement: ratingEngagement,
        rating_pace: ratingPace,
        note,
      };
      if (isParent && selectedStudentId) {
        payload.student = selectedStudentId;
      }

      const realFeedback = await api.post<SessionFeedback>("/feedback/", payload);
      const sessionTitle = selectedSession
        ? `${selectedSession.class_name} • ${new Date(
            selectedSession.scheduled_date
          ).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}`
        : "Debate Session";

      setLastSubmittedTitle(sessionTitle);
      setShowSuccessState(true);
      setSelectedSessionId("");
      setRatingClarity(0);
      setRatingEngagement(0);
      setRatingPace(0);
      setNote("");

      // Replace optimistic feedback with real one
      onSubmissionRollback?.(tempId);
      onFeedbackSubmitted?.(realFeedback);
    } catch (err: unknown) {
      // Rollback optimistic update
      onSubmissionRollback?.(tempId);
      setEligibleSessions(prevSessions);

      if (err instanceof ApiError && err.body) {
        const errorDetail =
          (err.body.detail as string) ||
          (Array.isArray(err.body.non_field_errors)
            ? err.body.non_field_errors[0]
            : "") ||
          (err.body.session as string) ||
          (err.body.student as string) ||
          "Failed to submit feedback. Please check your inputs.";
        setErrorMessage(String(errorDetail));
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

const RATING_LABELS: Record<number, string> = {
  1: "Needs Work",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Exceptional",
};

interface StarRatingProps {
  label: string;
  description: string;
  value: number;
  onChange: (val: number) => void;
}

function StarRatingRow({ label, description, value, onChange }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const activeRating = hovered !== null ? hovered : value;

  return (
    <div className="rounded-lg bg-white p-3 border border-gray-100 shadow-sm transition-all hover:border-gray-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-800">{label}</span>
            {activeRating > 0 ? (
              <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200/50">
                {activeRating}/5 • {RATING_LABELS[activeRating] || ""}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-400 border border-dashed border-gray-200">
                Select rating (1–5)
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">{description}</p>
        </div>

        {/* Interactive Star Row */}
        <div
          className="flex items-center gap-1.5"
          onMouseLeave={() => setHovered(null)}
          role="group"
          aria-label={`${label} rating`}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = star <= activeRating;
            return (
              <button
                key={star}
                type="button"
                onClick={() => onChange(star)}
                onMouseEnter={() => setHovered(star)}
                onFocus={() => setHovered(star)}
                onBlur={() => setHovered(null)}
                className="group relative p-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 transition-transform hover:scale-125 active:scale-95"
                title={`${star} of 5 - ${RATING_LABELS[star]}`}
                aria-label={`Rate ${star} out of 5: ${RATING_LABELS[star]}`}
              >
                <svg
                  className={`h-6 w-6 transition-colors duration-150 ${
                    isFilled
                      ? "text-amber-400 drop-shadow-sm fill-amber-400 stroke-amber-500"
                      : "text-gray-200 hover:text-amber-200 fill-gray-100 stroke-gray-300"
                  }`}
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                  />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

  return (
    <DashboardCard
      title="Submit Session Feedback"
      subtitle={
        showSuccessState
          ? "Submission Confirmed"
          : "Share structured feedback on completed sessions"
      }
    >
      {showSuccessState ? (
        <div className="rounded-xl bg-gradient-to-b from-emerald-50/60 to-white p-6 text-center border border-emerald-100 shadow-sm space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-gray-900">
              Feedback Submitted Successfully!
            </h3>
            <p className="text-xs text-gray-600 max-w-sm mx-auto">
              Your feedback for{" "}
              <span className="font-semibold text-cda-navy">
                {lastSubmittedTitle}
              </span>{" "}
              was securely recorded and anonymized.
            </p>
          </div>

          {eligibleSessions.length > 0 ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={resetFormToEmptyState}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-cda-navy px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-cda-navy/90 transition-all active:scale-95"
              >
                <span>Submit Feedback for Another Session</span>
                <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                  {eligibleSessions.length} left
                </span>
              </button>
            </div>
          ) : (
            <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 font-medium border border-emerald-100">
              🎉 All completed sessions from the last 30 days have now been reviewed. Thank you!
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Parent student selector */}
          {isParent && user?.family_links && user.family_links.length > 0 && (
            <div>
              <label
                htmlFor={studentSelectId}
                className="mb-1 block text-xs font-medium text-gray-700"
              >
                Select Student
              </label>
              <select
                id={studentSelectId}
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-cda-blue focus:outline-none focus:ring-1 focus:ring-cda-blue"
              >
                {user.family_links.map((link) => (
                  <option key={link.id} value={link.student}>
                    {link.student_display.display_name} ({link.relationship})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Eligible session selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor={sessionSelectId}
                className="block text-xs font-medium text-gray-700"
              >
                Eligible Completed Session (Last 30 Days)
              </label>
              {eligibleSessions.length > 0 && (
                <span className="text-[11px] text-gray-400">
                  {eligibleSessions.length} session{eligibleSessions.length > 1 ? "s" : ""} pending review
                </span>
              )}
            </div>

            {loadingSessions ? (
              <p className="py-2 text-xs text-gray-400">
                Loading eligible sessions...
              </p>
            ) : eligibleSessions.length === 0 ? (
              <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-500 border border-gray-100">
                No sessions currently eligible for feedback (completed within the last 30 days and not yet reviewed).
              </div>
            ) : (
              <select
                id={sessionSelectId}
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-cda-blue focus:outline-none focus:ring-1 focus:ring-cda-blue"
                required
              >
                <option value="" disabled>
                  -- Select a completed session to review --
                </option>
                {eligibleSessions.map((s) => {
                  const dateStr = new Date(s.scheduled_date).toLocaleDateString(
                    undefined,
                    { month: "short", day: "numeric", year: "numeric" }
                  );
                  return (
                    <option key={s.id} value={s.id}>
                      {s.class_name} • {dateStr}
                      {s.topic ? ` (${s.topic})` : ""} [{s.duration_minutes}m]
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Rating Dimensions */}
          {eligibleSessions.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 tracking-wide uppercase">
                  Session Evaluation (1–5 Stars)
                </span>
                <span className="text-[11px] text-gray-400">All 3 dimensions required</span>
              </div>

              <StarRatingRow
                label="Clarity"
                description="How clearly the instructor explained concepts and debate theory"
                value={ratingClarity}
                onChange={setRatingClarity}
              />

              <StarRatingRow
                label="Engagement"
                description="How well the instructor kept students focused, challenged, and participating"
                value={ratingEngagement}
                onChange={setRatingEngagement}
              />

              <StarRatingRow
                label="Pace"
                description="Balance of speed, content coverage, and practice rounds"
                value={ratingPace}
                onChange={setRatingPace}
              />
            </div>
          )}

          {/* Optional Note */}
          {eligibleSessions.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label
                  htmlFor={noteInputId}
                  className="block text-xs font-medium text-gray-700"
                >
                  Optional Comments / Note
                </label>
                <span
                  className={`text-xs ${
                    note.length > 480 ? "text-amber-600 font-semibold" : "text-gray-400"
                  }`}
                >
                  {note.length} / 500
                </span>
              </div>
              <textarea
                id={noteInputId}
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="What went well? Any suggestions for the instructor?"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-cda-blue focus:outline-none focus:ring-1 focus:ring-cda-blue"
              />
            </div>
          )}

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs font-medium text-red-700 border border-red-200">
              {errorMessage}
            </div>
          )}

          {/* Submit button */}
          {eligibleSessions.length > 0 && (
            <button
              type="submit"
              disabled={
                submitting ||
                !selectedSessionId ||
                !ratingClarity ||
                !ratingEngagement ||
                !ratingPace
              }
              className="w-full rounded-md bg-cda-navy px-4 py-2.5 text-sm font-medium text-white hover:bg-cda-navy/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-[0.99]"
            >
              {submitting
                ? "Submitting..."
                : !selectedSessionId
                ? "Please Select a Session Above"
                : !ratingClarity || !ratingEngagement || !ratingPace
                ? "Please Rate All 3 Dimensions (1–5 Stars)"
                : "Submit Feedback"}
            </button>
          )}
        </form>
      )}
    </DashboardCard>
  );
}
