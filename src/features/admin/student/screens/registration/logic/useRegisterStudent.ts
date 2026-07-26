"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { registerStudent, type RegisterPayload } from "./api";
import { queryKeys } from "@/shared/services/queryKeys";

export function useRegisterStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterPayload) => registerStudent(createClient(), payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.students.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
