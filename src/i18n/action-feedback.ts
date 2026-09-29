import type { AppMessages } from "./messages";
import { getServerTranslator } from "./server";

/**
 * Server-action feedback uses the same request locale as the page without
 * coupling domain/service errors to next-intl. Keys live under `feedback`
 * in the feature namespace.
 */
export async function getActionFeedback(namespace: keyof AppMessages) {
  const translator = await getServerTranslator(namespace as keyof AppMessages);
  return (key: string, values?: Record<string, string | number | Date>) =>
    (translator as unknown as (key: string, values?: Record<string, string | number | Date>) => string)(
      `feedback.${key}`,
      values,
    );
}
