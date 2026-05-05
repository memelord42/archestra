"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  currentUser,
  catalogItems as seedCatalogItems,
  credentials as seedCredentials,
  pods as seedPods,
  presetNames as seedPresetNames,
  presets as seedPresets,
  teams as seedTeams,
} from "./data";
import type {
  CatalogItem,
  Credential,
  FieldDef,
  Mapping,
  Pod,
  Preset,
  Team,
} from "./types";

export type TermDef = {
  singular: string;
  plural: string;
  Singular: string;
  Plural: string;
};

const TERM_STORAGE_KEY = "registry-v2-term";
const DEFAULT_SINGULAR = "preset";

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

function buildTerm(rawSingular: string): TermDef {
  const singular = rawSingular.trim() || DEFAULT_SINGULAR;
  const plural = singular.endsWith("s") ? singular : `${singular}s`;
  return {
    singular,
    plural,
    Singular: capitalize(singular),
    Plural: capitalize(plural),
  };
}

type StoreValue = {
  catalogItems: CatalogItem[];
  presets: Preset[];
  presetNames: string[];
  credentials: Credential[];
  pods: Pod[];
  teams: Team[];
  currentUser: typeof currentUser;
  term: TermDef;
  setTermSingular: (singular: string) => void;
  revokeCredential: (id: string) => void;
  installCredential: (input: Omit<Credential, "id" | "createdAt">) => void;
  upsertPreset: (preset: Preset) => void;
  deletePreset: (id: string) => void;
  upgradePreset: (id: string) => void;
  addPresetName: (name: string) => void;
  restartPod: (id: string) => void;
  addField: (catalogId: string, field: FieldDef) => void;
  addMapping: (catalogId: string, mapping: Mapping) => void;
};

const StoreContext = createContext<StoreValue | null>(null);

export function SpikeStoreProvider({ children }: { children: ReactNode }) {
  const [catalogItems, setCatalogItems] =
    useState<CatalogItem[]>(seedCatalogItems);
  const [presets, setPresets] = useState<Preset[]>(seedPresets);
  const [presetNames, setPresetNames] =
    useState<string[]>(seedPresetNames);
  const [credentials, setCredentials] = useState<Credential[]>(seedCredentials);
  const [pods, setPods] = useState<Pod[]>(seedPods);
  const [teams] = useState<Team[]>(seedTeams);
  const [termSingular, setTermSingularState] =
    useState<string>(DEFAULT_SINGULAR);

  // Hydrate term from localStorage after mount to avoid SSR mismatch.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(TERM_STORAGE_KEY);
    if (stored) setTermSingularState(stored);
  }, []);

  const term = useMemo(() => buildTerm(termSingular), [termSingular]);

  const value = useMemo<StoreValue>(
    () => ({
      catalogItems,
      presets,
      presetNames,
      credentials,
      pods,
      teams,
      currentUser,
      term,
      setTermSingular: (singular) => {
        setTermSingularState(singular);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(TERM_STORAGE_KEY, singular);
        }
      },
      revokeCredential: (id) =>
        setCredentials((cs) => cs.filter((c) => c.id !== id)),
      installCredential: (input) =>
        setCredentials((cs) => [
          ...cs,
          {
            ...input,
            id: `cred-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: new Date().toISOString(),
          },
        ]),
      upsertPreset: (preset) => {
        setPresets((ps) => {
          const exists = ps.some((p) => p.id === preset.id);
          return exists
            ? ps.map((p) => (p.id === preset.id ? preset : p))
            : [...ps, preset];
        });
        setPresetNames((ns) =>
          ns.includes(preset.label) ? ns : [...ns, preset.label],
        );
      },
      addPresetName: (name) =>
        setPresetNames((ns) => (ns.includes(name) ? ns : [...ns, name])),
      deletePreset: (id) => {
        setPresets((ps) => ps.filter((p) => p.id !== id));
        setCredentials((cs) => cs.filter((c) => c.presetId !== id));
        setPods((ps) => ps.filter((p) => p.presetId !== id));
      },
      upgradePreset: (id) =>
        setPresets((ps) =>
          ps.map((p) => (p.id === id ? { ...p, pinnedVersion: null } : p)),
        ),
      restartPod: (id) =>
        setPods((ps) =>
          ps.map((p) =>
            p.id === id
              ? { ...p, status: "restarting", restarts: p.restarts + 1 }
              : p,
          ),
        ),
      addField: (catalogId, field) =>
        setCatalogItems((cs) =>
          cs.map((c) =>
            c.id === catalogId ? { ...c, fields: [...c.fields, field] } : c,
          ),
        ),
      addMapping: (catalogId, mapping) =>
        setCatalogItems((cs) =>
          cs.map((c) =>
            c.id === catalogId
              ? { ...c, mappings: [...c.mappings, mapping] }
              : c,
          ),
        ),
    }),
    [catalogItems, presets, presetNames, credentials, pods, teams, term],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useSpikeStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("SpikeStoreProvider missing");
  return ctx;
}
