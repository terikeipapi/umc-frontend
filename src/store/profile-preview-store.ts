import { create } from "zustand";
import { isNicknameValid } from "../lib/member-form";

export interface PreviewProfile {
  email: string;
  nickname: string;
}

export const DEFAULT_PREVIEW_PROFILE: Readonly<PreviewProfile> = Object.freeze({
  email: "movie@example.com",
  nickname: "영화산책",
});

interface ProfilePreviewState {
  profile: PreviewProfile;
  updateNickname: (nickname: string) => boolean;
}

// Publishing-only state: no account, password, token, or browser storage.
export const useProfilePreviewStore = create<ProfilePreviewState>((set) => ({
  profile: { ...DEFAULT_PREVIEW_PROFILE },
  updateNickname: (nickname) => {
    if (!isNicknameValid(nickname)) return false;
    set((state) => ({ profile: { ...state.profile, nickname: nickname.trim() } }));
    return true;
  },
}));
