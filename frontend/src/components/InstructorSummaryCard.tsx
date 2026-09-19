"use client";

import { useEffect, useState, useId } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import type {
  InstructorFeedbackSummary,
  ClassItem,
  PaginatedResponse,
} from "@/lib/types";
import DashboardCard from "./DashboardCard";

interface InstructorSummaryCardProps {
  initialInstructorId?: number;
}

export default function InstructorSummaryCard({
  initialInstructorId,
}: InstructorSummaryCardProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [summary, setSummary] = useState<InstructorFeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Admin instructor switcher
  const [selectedInstructorId, setSelectedInstructorId] = useState<number | undefined>(
    initialInstructorId
  );
  const [instructors, setInstructors] = useState<{ id: number; name: string }[]>([]);
  const instructorSelectId = useId();

  // For admins, load available instructors from classes
  useEffect(() => {
    if (isAdmin) {
      api
        .get<PaginatedResponse<ClassItem>>("/classes/")
        .then((res) => {
          const map = new Map<number, string>();
          res.results.forEach((cls) => {
            if (cls.instructor_display) {
              map.set(
                cls.instructor_display.id,
                cls.instructor_display.display_name
              );
            }
          });
          const list = Array.from(map.entries()).map(([id, name]) => ({
            id,
            name,
          }));
          setInstructors(list);
          if (list.length > 0 && !selectedInstructorId) {
            setSelectedInstructorId(list[0].id);
          }
        })
        .catch(() => {});
    }
  }, [isAdmin, selectedInstructorId]);

  useEffect(() => {
    setLoading(true);
    setError("");

    let url = "/feedback/instructor-summary/";
    if (isAdmin && selectedInstructorId) {
      url += `?instructor_id=${selectedInstructorId}`;
    }

    api
      .get<InstructorFeedbackSummary>(url)
      .then((data) => setSummary(data))
      .catch(() => setError("Could not load instructor feedback summary."))
      .finally(() => setLoading(false));
  }, [isAdmin, selectedInstructorId]);

  const renderProgressBar = (
    label: string,
    score: number | null,
    barColor: string
  ) => {
    const percentage = score !== null ? Math.min(100, Math.max(0, (score / 5) * 100)) : 0;

    return (
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="font-medium text-gray-700">{label}</span>
          <span className="font-semibold text-gray-900">
            {score !== null ? `${score.toFixed(2)} / 5.0` : "No ratings"}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <DashboardCard
      title="Instructor Feedback Summary"
      subtitle="Weighted rolling average • Last 10 completed sessions"
      action={
        isAdmin ? (
          <div className="flex items-center gap-1.5">
            <label
              htmlFor={instructorSelectId}
              className="text-xs text-gray-500 whitespace-nowrap"
            >
              Instructor:
            </label>
            <select
              id={instructorSelectId}
              value={selectedInstructorId || summary?.instructor_id || ""}
              onChange={(e) => setSelectedInstructorId(Number(e.target.value))}
              className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:border-cda-blue focus:outline-none"
            >
              {instructors.length > 0 ? (
                instructors.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))
              ) : (
                <option value={summary?.instructor_id || ""}>
                  {summary?.instructor_name || "Loading instructors..."}
                </option>
              )}
            </select>
          </div>
        ) : undefined
      }
    >
      {loading ? (
        <p className="text-xs text-gray-400 py-3">Loading aggregated metrics...</p>
      ) : error ? (
        <p className="text-xs text-red-500 py-3">{error}</p>
      ) : !summary ? (
        <p className="text-xs text-gray-500 py-3">No summary data available.</p>
      ) : (
        <div className="space-y-4">
          {/* Anonymization Guarantee Notice */}
          <div className="flex items-center justify-between rounded-md bg-cda-navy/5 px-3 py-2 text-xs border border-cda-navy/10">
            <span className="font-medium text-cda-navy">
              Instructor: {summary.instructor_name}
            </span>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
              100% Anonymized & Aggregated
            </span>
          </div>

          {/* Hero Overall Metric and Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 rounded-lg bg-gray-50 p-3 text-center border border-gray-100 flex flex-col justify-center">
              <span className="text-xs text-gray-500 font-medium">
                Overall Score
              </span>
              <span className="mt-1 text-2xl font-bold text-cda-navy">
                {summary.overall_score !== null
                  ? summary.overall_score.toFixed(2)
                  : "N/A"}
              </span>
              <span className="text-[10px] text-gray-400">out of 5.0</span>
            </div>

            <div className="col-span-1 rounded-lg bg-gray-50 p-3 text-center border border-gray-100 flex flex-col justify-center">
              <span className="text-xs text-gray-500 font-medium">
                Total Reviews
              </span>
              <span className="mt-1 text-2xl font-bold text-cda-blue">
                {summary.total_feedback_count}
              </span>
              <span className="text-[10px] text-gray-400">across sessions</span>
            </div>

            <div className="col-span-1 rounded-lg bg-gray-50 p-3 text-center border border-gray-100 flex flex-col justify-center">
              <span className="text-xs text-gray-500 font-medium">
                Evaluated
              </span>
              <span className="mt-1 text-2xl font-bold text-gray-700">
                {summary.total_sessions_evaluated}
              </span>
              <span className="text-[10px] text-gray-400">
                of {summary.sessions_analyzed} sessions
              </span>
            </div>
          </div>

          {/* Dimension Progress Bars */}
          <div className="rounded-lg bg-gray-50/70 p-4 border border-gray-100 space-y-3">
            <p className="text-xs font-semibold text-gray-800">
              Dimensional Performance (Duration-Weighted):
            </p>
            {renderProgressBar("Concept Clarity", summary.rating_clarity, "bg-cda-navy")}
            {renderProgressBar(
              "Session Engagement",
              summary.rating_engagement,
              "bg-cda-blue"
            )}
            {renderProgressBar("Pacing & Coverage", summary.rating_pace, "bg-emerald-600")}
          </div>

          <p className="text-[11px] text-gray-400 italic text-center">
            * Aggregation is computed over the last 10 completed sessions, weighted
            by session duration in minutes. Student identities and qualitative notes
            are never accessible.
          </p>
        </div>
      )}
    </DashboardCard>
  );
}
