import * as z from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "i18next";
import {
  Button,
  Form,
  FormField,
  FormItem,
  Input,
  toast,
  FormMessage,
  FormLabel,
  Select,
  SelectItem,
  SelectTrigger,
  SelectContent,
} from "@renderer/components/ui";
import { AppSettingsProviderContext } from "@renderer/context";
import { useContext, useState } from "react";
import { LANGUAGES } from "@/constants";

const ankiConfigSchema = z.object({
  url: z.string().url(),
  key: z.string(),
  decks: z.array(
    z.object({
      language: z.string(),
      wordsDeck: z.string(),
      grammarDeck: z.string(),
    })
  ),
});
export const AnkiSettings = () => {
  const { anki, setAnki } = useContext(AppSettingsProviderContext);
  const [editing, setEditing] = useState(false);

  const form = useForm({
    mode: "onBlur",
    resolver: zodResolver(ankiConfigSchema),
    values: {
      url: anki?.url,
      key: anki?.key,
      decks: anki?.decks || [{ language: "", wordsDeck: "", grammarDeck: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "decks",
  });

  const onSubmit = async (data: z.infer<typeof ankiConfigSchema>) => {
    setAnki(data)
      .then(() => {
        toast.success(t("ankiConfigUpdated"));
      })
      .finally(() => {
        setEditing(false);
      });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex items-start justify-between py-4">
          <div className="">
            <div className="mb-2">anki-connect</div>
            <div className="text-sm text-muted-foreground mb-2 ml-1 space-y-3">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center space-x-2">
                      <FormLabel className="min-w-max">url:</FormLabel>
                      <Input
                        placeholder="https://anki.xxxx.com"
                        disabled={!editing}
                        value={field.value || ""}
                        onChange={field.onChange}
                      />
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center space-x-2">
                      <FormLabel className="min-w-max">key:</FormLabel>
                      <Input
                        disabled={!editing}
                        type="password"
                        placeholder=""
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {fields.map((deck, index) => (
                <div key={deck.id} className="space-y-3">
                  <FormField
                    control={form.control}
                    name={`decks.${index}.language`}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center space-x-2">
                          <FormLabel className="min-w-max">Language:</FormLabel>
                          <Select
                            disabled={!editing}
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>{field.value}</SelectTrigger>
                            <SelectContent>
                              {LANGUAGES.map((lang) => (
                                <SelectItem key={lang.code} value={lang.code}>
                                  {lang.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`decks.${index}.wordsDeck`}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center space-x-2">
                          <FormLabel className="min-w-max">
                            Words Deck:
                          </FormLabel>
                          <Input
                            disabled={!editing}
                            placeholder=""
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`decks.${index}.grammarDeck`}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center space-x-2">
                          <FormLabel className="min-w-max">
                            Grammar Deck:
                          </FormLabel>

                          <Input
                            disabled={!editing}
                            placeholder=""
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {editing && (
                    <Button
                      variant="destructive"
                      onClick={() => remove(index)}
                      size="sm"
                    >
                      {t("remove")}
                    </Button>
                  )}
                </div>
              ))}
              {editing && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    append({ language: "", wordsDeck: "", grammarDeck: "" })
                  }
                  size="sm"
                >
                  {t("addLanguage")}
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 justify-end">
            {editing ? (
              <>
                <Button
                  variant="secondary"
                  onClick={(e) => {
                    setEditing(!editing);
                    e.preventDefault();
                  }}
                  size="sm"
                >
                  {t("cancel")}
                </Button>
                <Button
                  variant="default"
                  onClick={() => onSubmit(form.getValues())}
                  size="sm"
                >
                  {t("save")}
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                onClick={(e) => {
                  setEditing(!editing);
                  e.preventDefault();
                }}
                size="sm"
              >
                {t("edit")}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
};
