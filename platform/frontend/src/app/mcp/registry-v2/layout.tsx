"use client";

import { PageLayout } from "@/components/page-layout";
import { Input } from "@/components/ui/input";
import { SpikeStoreProvider, useSpikeStore } from "./_seed/store";

export default function RegistryV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SpikeStoreProvider>
      <RegistryV2Inner>{children}</RegistryV2Inner>
    </SpikeStoreProvider>
  );
}

function RegistryV2Inner({ children }: { children: React.ReactNode }) {
  const { term, setTermSingular } = useSpikeStore();
  const tabs = [
    { href: "/mcp/registry-v2", label: "Catalog" },
    { href: "/mcp/registry-v2/presets", label: term.Plural },
    { href: "/mcp/registry-v2/fields", label: "Fields" },
  ];

  return (
    <PageLayout
      title={
        <span className="flex items-center gap-3">
          MCP Registry
          <span className="text-sm font-normal text-muted-foreground">
            v2 spike
          </span>
          <Input
            value={term.singular}
            onChange={(e) => setTermSingular(e.target.value)}
            placeholder="preset"
            className="h-7 w-[140px] text-xs"
            aria-label="Term"
          />
        </span>
      }
      description={`Frontend-only spike. Mock data, no real backend. Explore the proposed catalog → ${term.singular} → install model.`}
      tabs={tabs}
    >
      {children}
    </PageLayout>
  );
}
