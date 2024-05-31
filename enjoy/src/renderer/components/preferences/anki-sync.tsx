import { t } from "i18next";
import { Button, FormLabel, Label } from "@renderer/components/ui";
import { AppSettingsProviderContext } from "@renderer/context";
import { useContext, useState } from "react";
import { Client } from "@/api";
import { isNil } from "lodash";

export const AnkiSync = () => {
  const { anki } = useContext(AppSettingsProviderContext);
  const [syncing, setSyncing] = useState(false);
  const syncAnki = async (): Promise<void> => {
    if (isNil(anki.url)) {
      throw new Error("no anki url");
    }
    const client = new Client({
      baseUrl: anki.url,
    });
    try {
      await client.api.post("", {
        action: "sync",
        version: 6,
        key: anki.key,
      });
    } catch (error) {
      throw new Error(`anki sync error ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };
  return (
    <div className="flex items-start justify-between py-4">
      <div className="">
        <div className="mb-2">anki-sync</div>
        <div className="text-sm text-muted-foreground mb-2 ml-1 space-y-3">
          <div className="flex items-center space-x-2">
            <Label className="min-w-max">start:</Label>
            <Button
              disabled={syncing}
              variant="secondary"
              onClick={(e) => {
                setSyncing(true);
                syncAnki();
                e.preventDefault();
              }}
              size="sm"
            >
              sync
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
