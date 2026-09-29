"use client";

import * as React from "react";

type FormAction = (formData: FormData) => void;

type PreservingActionFormProps = Omit<
  React.ComponentPropsWithoutRef<"form">,
  "action" | "onSubmit"
> & {
  action: FormAction;
};

/**
 * Dispatches a useActionState action without using the native `form action`
 * submission path. React resets uncontrolled form controls after a form action
 * completes, which is undesirable when the server returns validation errors.
 *
 * Keeping submission under `onSubmit` leaves the current DOM values intact.
 * Successful dialog actions can still close/unmount the form as before.
 */
export function PreservingActionForm({
  action,
  children,
  ...props
}: PreservingActionFormProps) {
  const submitForm = React.useCallback(
    (form: HTMLFormElement, submitter: HTMLElement | null) => {
      const formData = new FormData(form);

      if (
        submitter instanceof HTMLButtonElement ||
        submitter instanceof HTMLInputElement
      ) {
        if (submitter.name) {
          formData.set(submitter.name, submitter.value);
        }
      }

      React.startTransition(() => {
        action(formData);
      });
    },
    [action],
  );

  return (
    <form
      {...props}
      onSubmit={(event) => {
        event.preventDefault();

        const submitter =
          event.nativeEvent instanceof SubmitEvent
            ? event.nativeEvent.submitter
            : null;

        submitForm(event.currentTarget, submitter);
      }}
    >
      {children}
    </form>
  );
}
