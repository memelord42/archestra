"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CatalogItem } from "./mcp-server-card";

interface PresetPickerDialogProps {
  parent: CatalogItem | null;
  onClose: () => void;
  onPick: (childId: string) => Promise<void> | void;
}

export function PresetPickerDialog({
  parent,
  onClose,
  onPick,
}: PresetPickerDialogProps) {
  const [pickingId, setPickingId] = useState<string | null>(null);

  const children = parent?.children ?? [];

  const handlePick = async (childId: string) => {
    setPickingId(childId);
    try {
      await onPick(childId);
    } finally {
      setPickingId(null);
    }
  };

  return (
    <Dialog open={!!parent} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Install {parent?.name}</DialogTitle>
          <DialogDescription>
            Pick a preset to install. Each preset is a separate installation
            with its own pre-filled configuration.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          {children.map((child) => (
            <Button
              key={child.id}
              variant="outline"
              className="h-auto justify-between gap-3 px-4 py-3 text-left"
              onClick={() => handlePick(child.id)}
              disabled={pickingId !== null}
            >
              <div className="flex min-w-0 flex-col items-start gap-0.5">
                <span className="font-medium">{child.name}</span>
                {child.description && (
                  <span className="text-xs text-muted-foreground line-clamp-2">
                    {child.description}
                  </span>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
