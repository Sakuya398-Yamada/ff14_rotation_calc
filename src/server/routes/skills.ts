import { Hono } from "hono";
import { prisma } from "../db.js";

const skills = new Hono();

skills.get("/", async (c) => {
  const allSkills = await prisma.skill.findMany();
  return c.json(allSkills);
});

export { skills };
