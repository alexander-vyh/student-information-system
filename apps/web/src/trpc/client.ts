"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@sis/api";

export const trpc = createTRPCReact<AppRouter>();
