import { Hono } from "hono";
import { prisma } from "../db.js";

const skills = new Hono();

skills.get("/", async (c) => {
  const allSkills = await prisma.skill.findMany();
  const parsed = allSkills.map((skill) => ({
    ...skill,
    resourceChanges: skill.resourceChanges
      ? JSON.parse(skill.resourceChanges)
      : undefined,
    buffApplications: skill.buffApplications
      ? JSON.parse(skill.buffApplications)
      : undefined,
    buffConsumptions: skill.buffConsumptions
      ? JSON.parse(skill.buffConsumptions)
      : undefined,
  }));
  return c.json(parsed);
});

export { skills };
