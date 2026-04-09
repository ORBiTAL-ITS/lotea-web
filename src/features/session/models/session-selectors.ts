import { RootState } from "@/app/store";

export const selectSessionUser = (state: RootState) => state.session.user;
export const selectSessionHydrated = (state: RootState) => state.session.hydrated;
