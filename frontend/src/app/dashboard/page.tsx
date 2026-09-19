"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import type { PaginatedResponse, SessionFeedback } from "@/lib/types";
import ActiveClassesCard from "@/components/ActiveClassesCard";
import ProfileCard from "@/components/ProfileCard";
import FeedbackSubmissionCard from "@/components/FeedbackSubmissionCard";
import FeedbackHistoryCard from "@/components/FeedbackHistoryCard";
import InstructorSummaryCard from "@/components/InstructorSummaryCard";

/**
 * myCDA Dashboard
 *
 * Cards are rendered based on the user's role.
 * - Students & Parents: Feedback submission card and Feedback history card.
 * - Instructors & Admins: Anonymized instructor summary card.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<SessionFeedback[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const isStudentOrParent = user?.role === "student" || user?.role === "parent";
  const isInstructorOrAdmin = user?.role === "instructor" || user?.role === "admin";

  const fetchHistory = useCallback(() => {
    if (!isStudentOrParent) return;
    setLoadingHistory(true);
    setHistoryError("");

    api
      .get<PaginatedResponse<SessionFeedback>>("/feedback/my/?page=1&page_size=5")
      .then((res) => {
        setFeedbacks(res.results);
        setTotalCount(res.count);
        setCurrentPage(1);
        setHasMore(res.results.length < res.count);
      })
      .catch(() => {
        setHistoryError("Could not load feedback history.");
      })
      .finally(() => {
        setLoadingHistory(false);
      });
  }, [isStudentOrParent]);

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = currentPage + 1;

    api
      .get<PaginatedResponse<SessionFeedback>>(
        `/feedback/my/?page=${nextPage}&page_size=5`
      )
      .then((res) => {
        setFeedbacks((prev) => {
          const existingIds = new Set(prev.map((f) => f.id));
          const newItems = res.results.filter((f) => !existingIds.has(f.id));
          const updated = [...prev, ...newItems];
          setHasMore(updated.length < res.count);
          return updated;
        });
        setCurrentPage(nextPage);
        setTotalCount(res.count);
      })
      .catch(() => {
        setHistoryError("Failed to load more reviews.");
      })
      .finally(() => {
        setLoadingMore(false);
      });
  };

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFeedbackSubmitted = (newFeedback: SessionFeedback) => {
    setFeedbacks((prev) => {
      // Avoid duplicate keys if replacing
      const filtered = prev.filter((item) => item.id !== newFeedback.id);
      return [newFeedback, ...filtered];
    });
    setTotalCount((prev) => prev + 1);
  };

  const handleSubmissionRollback = (tempId: number) => {
    setFeedbacks((prev) => prev.filter((item) => item.id !== tempId));
    setTotalCount((prev) => Math.max(0, prev - 1));
  };

  if (!user) return null;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Dashboard</h1>
      <p className="mb-6 text-sm text-gray-500">
        Welcome back, {user.display_name}
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Core Profile & Active Classes Cards */}
        <ActiveClassesCard />
        <ProfileCard />

        {/* Feedback Cards for Students and Parents */}
        {isStudentOrParent && (
          <>
            <div id="feedback" className="contents">
              <FeedbackSubmissionCard
                onFeedbackSubmitted={handleFeedbackSubmitted}
                onSubmissionRollback={handleSubmissionRollback}
              />
              <FeedbackHistoryCard
                feedbacks={feedbacks}
                loading={loadingHistory}
                error={historyError}
                totalCount={totalCount}
                hasMore={hasMore}
                loadingMore={loadingMore}
                onLoadMore={handleLoadMore}
              />
            </div>
          </>
        )}

        {/* Instructor Summary Card for Instructors & Admins */}
        {isInstructorOrAdmin && (
          <div id="feedback" className="col-span-1">
            <InstructorSummaryCard />
          </div>
        )}
      </div>
    </div>
  );
}
