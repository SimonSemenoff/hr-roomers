"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import VacanciesPanel from "@/components/VacanciesPanel";
import CandidateTable from "@/components/CandidateTable";
import SourcesPanel from "@/components/SourcesPanel";
import CompanyProfilePanel from "@/components/CompanyProfilePanel";

type View = "vacancies" | "candidates" | "sources" | "profile";

export default function Home() {
  const [view, setView] = useState<View>("vacancies");
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);

  function handleViewCandidates(vacancyId: string) {
    setActiveCandidateId(vacancyId);
    setView("candidates");
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar activeView={view} onChangeView={setView} />
      <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
        {view === "vacancies" && <VacanciesPanel onViewCandidates={handleViewCandidates} />}
        {view === "candidates" && (
          <CandidateTable searchId={activeCandidateId} onBack={() => setView("vacancies")} />
        )}
        {view === "sources" && <SourcesPanel />}
        {view === "profile" && <CompanyProfilePanel />}
      </main>
    </div>
  );
}
