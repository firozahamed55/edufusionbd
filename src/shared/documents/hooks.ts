"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import * as api from "./assets";

const c = () => createClient();

/** Letterhead and signatures change roughly never; a document preview should
 *  not re-fetch them per page. */
const STATIC = 5 * 60_000;

export const useLetterhead = () =>
  useQuery({ queryKey: queryKeys.documents.letterhead, queryFn: () => api.fetchLetterhead(c()), staleTime: STATIC });

export const useDocSignatures = () =>
  useQuery({ queryKey: queryKeys.documents.signatures, queryFn: () => api.fetchDocSignatures(c()), staleTime: STATIC });

/** Signed photo URLs for a batch. Signed URLs expire, so this deliberately
 *  does NOT get a long staleTime — a preview left open for two hours must
 *  refetch rather than render broken images. */
export const useStudentPhotoUrls = (fileIds: readonly (string | null)[]) => {
  const ids = [...new Set(fileIds.filter((v): v is string => !!v))].sort();
  return useQuery({
    queryKey: queryKeys.documents.photos(ids),
    queryFn: () => api.fetchStudentPhotoUrls(c(), ids),
    enabled: ids.length > 0,
    staleTime: 30 * 60_000,
  });
};
