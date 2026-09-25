import type { AxiosAdapter } from "axios";

/** Native/default boundary: let Axios select its platform adapter. */
export const getRiotHttpAdapter = (): AxiosAdapter | undefined => undefined;
