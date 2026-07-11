"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import * as api from "./api";

const c = () => createClient();
const HOUR = 60 * 60_000;

export const useDivisions = () =>
  useQuery({ queryKey: ["lookup", "divisions"], queryFn: () => api.fetchDivisions(c()), staleTime: HOUR });

export const useDistricts = (divisionId: string | null) =>
  useQuery({
    queryKey: ["lookup", "districts", divisionId],
    queryFn: () => api.fetchDistricts(c(), divisionId as string),
    enabled: !!divisionId,
    staleTime: HOUR,
  });

export const useUpazilas = (districtId: string | null) =>
  useQuery({
    queryKey: ["lookup", "upazilas", districtId],
    queryFn: () => api.fetchUpazilas(c(), districtId as string),
    enabled: !!districtId,
    staleTime: HOUR,
  });

export const useAcademicYears = () =>
  useQuery({ queryKey: ["lookup", "years"], queryFn: () => api.fetchAcademicYears(c()), staleTime: 5 * 60_000 });

export const useClassSectionsLookup = () =>
  useQuery({ queryKey: ["lookup", "class-sections"], queryFn: () => api.fetchClassSections(c()), staleTime: 5 * 60_000 });

export const useStudentCategories = () =>
  useQuery({ queryKey: ["lookup", "student-categories"], queryFn: () => api.fetchStudentCategories(c()), staleTime: 5 * 60_000 });

export const useClasses = () =>
  useQuery({ queryKey: ["lookup", "classes"], queryFn: () => api.fetchClasses(c()), staleTime: 5 * 60_000 });

export const useDesignations = () =>
  useQuery({ queryKey: ["lookup", "designations"], queryFn: () => api.fetchDesignations(c()), staleTime: 5 * 60_000 });

export const useDepartments = () =>
  useQuery({ queryKey: ["lookup", "departments"], queryFn: () => api.fetchDepartments(c()), staleTime: 5 * 60_000 });

export const useSubjects = () =>
  useQuery({ queryKey: ["lookup", "subjects"], queryFn: () => api.fetchSubjects(c()), staleTime: 5 * 60_000 });
