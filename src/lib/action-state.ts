export type ActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const emptyActionState: ActionState = {
  ok: false,
  message: "",
};
