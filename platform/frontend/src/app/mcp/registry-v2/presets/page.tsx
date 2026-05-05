"use client";

import { Download, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DeploymentStatusDot } from "@/app/mcp/registry/_parts/deployment-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { presetHealth } from "../_parts/utils";
import { useSpikeStore } from "../_seed/store";

export default function CrossCatalogPresetsPage() {
  const { catalogItems, presets, credentials, pods, term } = useSpikeStore();
  const [catFilter, setCatFilter] = useState("all");
  const [visFilter, setVisFilter] = useState("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    return presets
      .filter((p) => catFilter === "all" || p.catalogId === catFilter)
      .filter((p) => {
        if (visFilter === "all") return true;
        if (visFilter === "org") return p.visibility.kind === "org";
        return p.visibility.kind === "team";
      })
      .filter((p) => {
        if (!search) return true;
        const q = search.toLowerCase();
        const cat = catalogItems.find((c) => c.id === p.catalogId);
        return (
          p.label.toLowerCase().includes(q) ||
          (cat?.name.toLowerCase().includes(q) ?? false)
        );
      });
  }, [presets, catFilter, visFilter, search, catalogItems]);

  const totals = useMemo(() => {
    const callers = rows.reduce(
      (acc, p) => acc + credentials.filter((c) => c.presetId === p.id).length,
      0,
    );
    const pcount = rows.reduce(
      (acc, p) => acc + pods.filter((pod) => pod.presetId === p.id).length,
      0,
    );
    return { presets: rows.length, callers, pods: pcount };
  }, [rows, credentials, pods]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          All {term.plural} across every catalog item. Drilldown opens the
          catalog item scoped to the chosen {term.singular}.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4" />
            New {term.singular}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search by ${term.singular} or catalog…`}
              className="max-w-[260px]"
            />
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Catalog" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All catalogs</SelectItem>
                {catalogItems.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={visFilter} onValueChange={setVisFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All visibilities</SelectItem>
                <SelectItem value="org">Org-wide</SelectItem>
                <SelectItem value="team">Team</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{term.Singular}</TableHead>
                <TableHead>Catalog</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Callers</TableHead>
                <TableHead className="text-right">Pods</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const cat = catalogItems.find((c) => c.id === p.catalogId);
                if (!cat) return null;
                const callers = credentials.filter(
                  (c) => c.presetId === p.id,
                ).length;
                const ppods = pods.filter((pod) => pod.presetId === p.id);
                const health = presetHealth(ppods.map((pod) => pod.status));
                const label =
                  ppods.length === 0
                    ? "no pods"
                    : health === "running"
                      ? "up"
                      : health;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href="/mcp/registry-v2"
                        className="font-medium hover:underline"
                      >
                        {p.label}
                      </Link>
                      {p.isDefault && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          default
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href="/mcp/registry-v2"
                        className="text-sm hover:underline"
                      >
                        {cat.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {p.visibility.kind === "org" ? (
                        <Badge variant="secondary" className="text-[10px]">
                          org-wide
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          team: {p.visibility.teamName}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {callers}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {ppods.length}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-xs">
                        {ppods.length > 0 ? (
                          <DeploymentStatusDot state={health} />
                        ) : (
                          <span className="inline-block h-2 w-2 rounded-full bg-muted" />
                        )}
                        {label}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="text-xs text-muted-foreground">
            {totals.presets} {term.plural} · {totals.callers} callers ·{" "}
            {totals.pods} pods
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
