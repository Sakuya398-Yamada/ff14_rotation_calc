import { z } from "zod";
import { JOB_DATA, type JobId } from "../../client/data/job-registry";
import { MAX_TITLE_LENGTH } from "../../client/logic/shared-timeline";
import { SCHEMA_VERSION } from "../../client/logic/timeline-storage";

const MAX_ENTRIES = 2000;

const JOB_IDS = Object.keys(JOB_DATA) as [JobId, ...JobId[]];
const SKILL_IDS_BY_JOB = Object.fromEntries(
  JOB_IDS.map((job) => [job, new Set(JOB_DATA[job].skills.map((s) => s.id))]),
) as Record<JobId, Set<string>>;

// deserializeAppState（localStorage の復元）は不明なスキル ID のエントリを黙って除外するが、サーバーは保存した行を書き換えないので拒否する
export const persistedAppStateSchema = z
  .object({
    version: z.literal(SCHEMA_VERSION),
    selectedJob: z.enum(JOB_IDS),
    level: z.literal([70, 80, 90, 100]),
    entries: z
      .array(z.object({ uid: z.string(), skillId: z.string(), manualStartTime: z.number().optional() }))
      .max(MAX_ENTRIES),
    stats: z.object({
      critical: z.number(),
      directHit: z.number(),
      determination: z.number(),
      speed: z.number(),
    }),
    untargetableWindows: z.array(z.object({ startTime: z.number(), endTime: z.number() })),
    multiTargetWindows: z.array(
      z.object({ startTime: z.number(), endTime: z.number(), targetCount: z.number().min(2) }),
    ),
  })
  .superRefine((data, ctx) => {
    const skillIds = SKILL_IDS_BY_JOB[data.selectedJob];
    data.entries.forEach((entry, i) => {
      if (!skillIds.has(entry.skillId)) {
        ctx.addIssue({ code: "custom", path: ["entries", i, "skillId"], message: "unknown skill id" });
      }
    });
  });

// nanoid の既定の 21 文字（base64url）
const timelineIdSchema = z.string().regex(/^[A-Za-z0-9_-]{21}$/);

export const saveTimelineRequestSchema = z.object({
  data: persistedAppStateSchema,
  title: z.string().max(MAX_TITLE_LENGTH).optional(),
  parentId: timelineIdSchema.optional(),
});

export const timelineIdParamSchema = z.object({ id: timelineIdSchema });
