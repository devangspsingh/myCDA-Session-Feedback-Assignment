"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { SessionFeedback } from "@/lib/types";
import DashboardCard from "./DashboardCard";

interface FeedbackHistoryCardProps {
  feedbacks: SessionFeedback[];
  loading: boolean;
  error?: string;
  totalCount?: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

function getInitials(name?: string): string {
  if (!name) return "S";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${count} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-2.5 w-2.5 ${
            star <= count ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function FeedbackHistoryCard({
  feedbacks,
  loading,
  error,
  totalCount,
  hasMore,
  loadingMore,
  onLoadMore,
}: FeedbackHistoryCardProps) {
  const { user } = useAuth();
  const isParent = user?.role === "parent";
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>("all");

  // Group feedbacks by student for parent role
  const studentGroups = useMemo(() => {
    if (!isParent) return [];
    const map = new Map<number, { studentId: number; studentName: string; items: SessionFeedback[] }>();
    for (const fb of feedbacks) {
      const sid = fb.student || 0;
      const sname = fb.student_display?.display_name || "Enrolled Student";
      if (!map.has(sid)) {
        map.set(sid, { studentId: sid, studentName: sname, items: [] });
      }
      map.get(sid)!.items.push(fb);
    }
    return Array.from(map.values());
  }, [feedbacks, isParent]);

  const activeStudentGroup = studentGroups.find(
    (g) => String(g.studentId) === selectedStudentFilter
  );
  const isFiltered = isParent && selectedStudentFilter !== "all" && Boolean(activeStudentGroup);
  const displayedCount = isFiltered
    ? (activeStudentGroup?.items.length ?? 0)
    : feedbacks.length;

  const subtitleText = useMemo(() => {
    if (isFiltered && activeStudentGroup) {
      if (hasMore) {
        return `${displayedCount} review${displayedCount !== 1 ? "s" : ""} loaded for ${activeStudentGroup.studentName}`;
      }
      return `${displayedCount} review${displayedCount !== 1 ? "s" : ""} (${activeStudentGroup.studentName})`;
    }
    const effectiveTotal = totalCount && totalCount > feedbacks.length ? totalCount : feedbacks.length;
    return hasMore || (totalCount && totalCount > feedbacks.length)
      ? `Showing ${feedbacks.length} of ${effectiveTotal} review${effectiveTotal !== 1 ? "s" : ""}`
      : `${feedbacks.length} review${feedbacks.length !== 1 ? "s" : ""}`;
  }, [isFiltered, activeStudentGroup, displayedCount, hasMore, totalCount, feedbacks.length]);

  if (loading && feedbacks.length === 0) {
    return (
      <DashboardCard title="Feedback History">
        <p className="text-xs text-gray-400">Loading your feedback history...</p>
      </DashboardCard>
    );
  }

  if (error && feedbacks.length === 0) {
    return (
      <DashboardCard title="Feedback History">
        <p className="text-xs text-red-500">{error}</p>
      </DashboardCard>
    );
  }

  if (feedbacks.length === 0) {
    return (
      <DashboardCard title="Feedback History" subtitle="0 submissions">
        <div className="rounded-md bg-gray-50 p-4 text-center text-xs text-gray-500">
          No feedback submitted yet. Your submitted session reviews will appear here.
        </div>
      </DashboardCard>
    );
  }

  // Filtered groups if parent selected a specific student tab
  const displayedGroups = studentGroups.filter((g) =>
    selectedStudentFilter === "all" ? true : String(g.studentId) === selectedStudentFilter
  );

  const renderFeedbackItem = (fb: SessionFeedback) => {
    const sessionDate = fb.session_detail?.scheduled_date
      ? new Date(fb.session_detail.scheduled_date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Recent session";

    const isOptimistic = fb.id < 0;

    return (
      <div
        key={fb.id}
        className={`px-3.5 py-2.5 transition-colors ${
          isOptimistic ? "bg-amber-50/40 opacity-80" : "hover:bg-slate-50/50"
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-xs font-semibold text-gray-900 truncate">
                {fb.session_detail?.class_name || "Debate Class"}
              </span>
              {isOptimistic && (
                <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-medium text-amber-700 shrink-0">
                  Submitting...
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 truncate mt-0.5">
              {sessionDate}
              {fb.session_detail?.topic ? ` · ${fb.session_detail.topic}` : ""}
            </p>
          </div>

          <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0">
            {new Date(fb.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

        {/* 3 Dimensional Star Ratings (Compact Inline Ribbon) */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Clarity:</span>
            <span className="font-semibold text-gray-700">{fb.rating_clarity}/5</span>
            <StarRating count={fb.rating_clarity} />
          </div>
          <span className="text-gray-200 hidden sm:inline">•</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Engagement:</span>
            <span className="font-semibold text-gray-700">{fb.rating_engagement}/5</span>
            <StarRating count={fb.rating_engagement} />
          </div>
          <span className="text-gray-200 hidden sm:inline">•</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Pace:</span>
            <span className="font-semibold text-gray-700">{fb.rating_pace}/5</span>
            <StarRating count={fb.rating_pace} />
          </div>
        </div>

        {/* Note / Feedback Comment (Compact) */}
        {fb.note && (
          <p className="mt-1.5 text-[11px] text-gray-600 bg-slate-50 py-1 px-2.5 rounded border border-slate-200/70 italic leading-snug">
            &ldquo;{fb.note}&rdquo;
          </p>
        )}

        {/* Submitter Attribution */}
        {fb.submitter_display?.display_name && (
          <p className="mt-1 text-[10px] text-gray-400">
            Submitted by {fb.submitter_display.display_name}
          </p>
        )}
      </div>
    );
  };

  return (
    <DashboardCard title="Feedback History" subtitle={subtitleText} flush>
      {/* Student Filter Tabs for Parents */}
      {isParent && studentGroups.length > 1 && (
        <div className="flex items-center gap-1 px-3.5 py-1.5 border-b border-gray-100 bg-slate-50/50 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedStudentFilter("all")}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
              selectedStudentFilter === "all"
                ? "bg-cda-navy text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            All Children ({feedbacks.length})
          </button>
          {studentGroups.map((group) => (
            <button
              key={group.studentId}
              type="button"
              onClick={() => setSelectedStudentFilter(String(group.studentId))}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedStudentFilter === String(group.studentId)
                  ? "bg-cda-navy text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              {group.studentName} ({group.items.length})
            </button>
          ))}
        </div>
      )}

      {/* Reviews Content Area */}
      <div className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
        {isFiltered && displayedCount === 0 && (
          <div className="p-8 text-center text-xs text-gray-500 bg-slate-50/40">
            <p className="font-semibold text-gray-700">
              No reviews loaded yet for {activeStudentGroup?.studentName}.
            </p>
            {hasMore ? (
              <p className="mt-1.5 text-[11px] text-gray-400">
                More reviews exist in your account history. Click &ldquo;Load More Reviews&rdquo; below to fetch more.
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-gray-400">
                No past session reviews found for this student.
              </p>
            )}
          </div>
        )}

        {isParent ? (
          displayedGroups.map((group) => (
            <div key={group.studentId} className="border-b border-gray-100 last:border-b-0">
              {/* Group Header for Child (Compact) */}
              <div className="sticky top-0 z-10 flex items-center justify-between bg-slate-100/90 px-3.5 py-1.5 backdrop-blur-xs border-y border-slate-200/70">
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cda-navy text-[9px] font-bold text-white uppercase">
                    {getInitials(group.studentName)}
                  </div>
                  <span className="text-[11px] font-bold text-gray-800 tracking-tight">
                    {group.studentName}
                  </span>
                </div>
                <span className="rounded-full bg-white px-1.5 py-0.2 text-[9px] font-semibold text-gray-600 border border-gray-200">
                  {group.items.length} {group.items.length === 1 ? "review" : "reviews"}
                </span>
              </div>

              {/* Child's Reviews */}
              <div className="divide-y divide-gray-100 bg-white">
                {group.items.map((fb) => renderFeedbackItem(fb))}
              </div>
            </div>
          ))
        ) : (
          feedbacks.map((fb) => renderFeedbackItem(fb))
        )}
      </div>


      {/* Load More Action Button */}
      {hasMore && (
        <div className="p-3 text-center bg-gray-50/50 border-t border-gray-100">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
          >
            {loadingMore ? (
              <>
                <svg
                  className="h-3.5 w-3.5 animate-spin text-cda-navy"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Loading more reviews...</span>
              </>
            ) : (
              <>
                <span>Load More Reviews</span>
                {totalCount && totalCount > feedbacks.length ? (
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 font-medium">
                    {totalCount - feedbacks.length} more in history
                  </span>
                ) : null}
              </>
            )}
          </button>
        </div>
      )}

      {/* Complete List Loaded Confirmation */}
      {!hasMore && displayedCount > 0 && (
        <div className="py-2.5 text-center text-[11px] text-gray-400 bg-gray-50/30 border-t border-gray-100">
          ✓ {isFiltered && activeStudentGroup
            ? `All ${displayedCount} reviews for ${activeStudentGroup.studentName} loaded`
            : `All ${feedbacks.length} reviews loaded`}
        </div>
      )}
      {!hasMore && isFiltered && displayedCount === 0 && (
        <div className="py-2.5 text-center text-[11px] text-gray-400 bg-gray-50/30 border-t border-gray-100">
          ✓ No reviews found for {activeStudentGroup?.studentName}
        </div>
      )}
    </DashboardCard>
  );
}


