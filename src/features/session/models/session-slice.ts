import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { SessionUser } from "./session-types";

type SessionState = {
  user: SessionUser | null;
  /** Firebase onAuthStateChanged ya disparó al menos una vez */
  hydrated: boolean;
};

const initialState: SessionState = {
  user: null,
  hydrated: false,
};

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    setSessionUser(state, action: PayloadAction<SessionUser | null>) {
      state.user = action.payload;
      state.hydrated = true;
    },
  },
});

export const { setSessionUser } = sessionSlice.actions;
export const sessionReducer = sessionSlice.reducer;
