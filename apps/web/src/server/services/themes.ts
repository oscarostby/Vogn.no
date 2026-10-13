import 'server-only';
import { runTransaction, type CrewThemeDoc } from '@vogn/database';
import { applyTheme, isPresetId, presetManifest, safeManifest, themeManifestSchema, type ThemeInstallMode, type ThemeManifest } from '@vogn/theme-engine';
import { ObjectId } from 'mongodb';
import type { AuthedContext, ServiceContext } from '../context';
import { requireActive } from '../context';
import { badRequest, conflict, notFound } from '../errors';
import { toUserSummary } from '../mappers';
import { getVisibleCrewAccess, requirePermission } from './crew-access';

function state(doc: CrewThemeDoc) {
  const draft = safeManifest(doc.draft).manifest;
  const published = doc.published ? safeManifest(doc.published).manifest : null;
  return { crewId: doc.crewId.toHexString(), draft, draftUpdatedAt: doc.draftUpdatedAt.toISOString(), published,
    publishedVersion: doc.publishedVersion, publishedAt: doc.publishedAt?.toISOString() ?? null,
    hasUnpublishedChanges: JSON.stringify(draft) !== JSON.stringify(published) };
}

export async function publishedTheme(ctx: ServiceContext, crewId: ObjectId) {
  await getVisibleCrewAccess(ctx, crewId);
  const doc = await ctx.cols.crewThemes.findOne({ crewId });
  return { crewId: crewId.toHexString(), manifest: safeManifest(doc?.published ?? presetManifest('vogn-minimal')).manifest, version: doc?.publishedVersion ?? null };
}

export async function studioTheme(ctx: AuthedContext, crewId: ObjectId) {
  const access = await getVisibleCrewAccess(ctx, crewId);
  requirePermission(access, 'MANAGE_THEMES');
  const doc = await ctx.cols.crewThemes.findOne({ crewId });
  if (!doc) throw notFound('Crew theme');
  return state(doc);
}

export async function saveTheme(ctx: AuthedContext, crewId: ObjectId, raw: unknown) {
  requireActive(ctx);
  const access = await getVisibleCrewAccess(ctx, crewId);
  requirePermission(access, 'MANAGE_THEMES');
  const manifest = themeManifestSchema.parse(raw);
  const doc = await ctx.cols.crewThemes.findOneAndUpdate({ crewId }, { $set: { draft: manifest as unknown as Record<string, unknown>, draftUpdatedAt: ctx.now, draftUpdatedBy: ctx.actor.userId } }, { returnDocument: 'after' });
  if (!doc) throw notFound('Crew theme');
  return state(doc);
}

export async function publishTheme(ctx: AuthedContext, crewId: ObjectId, note?: string, restoredFrom: number | null = null, restoredManifest?: ThemeManifest) {
  requireActive(ctx);
  const access = await getVisibleCrewAccess(ctx, crewId);
  requirePermission(access, 'MANAGE_THEMES');
  return runTransaction(ctx.client, async (session) => {
    const doc = await ctx.cols.crewThemes.findOne({ crewId }, { session });
    if (!doc) throw notFound('Crew theme');
    const manifest = themeManifestSchema.parse(restoredManifest ?? doc.draft) as unknown as Record<string, unknown>;
    const version = (doc.publishedVersion ?? 0) + 1;
    const updated = await ctx.cols.crewThemes.findOneAndUpdate({ _id: doc._id, publishedVersion: doc.publishedVersion, draftUpdatedAt: doc.draftUpdatedAt },
      { $set: { published: manifest, publishedVersion: version, publishedAt: ctx.now, ...(restoredManifest ? { draft: manifest, draftUpdatedAt: ctx.now, draftUpdatedBy: ctx.actor.userId } : {}) } }, { session, returnDocument: 'after' });
    if (!updated) throw conflict('The theme changed. Reload and publish again.');
    await ctx.cols.crewThemeVersions.insertOne({ _id: new ObjectId(), crewId, version, manifest, note: note ?? null, publishedBy: ctx.actor.userId, publishedAt: ctx.now, restoredFrom }, { session });
    await ctx.cols.crews.updateOne({ _id: crewId }, { $set: { accentColor: (manifest.colors as ThemeManifest['colors']).accent, updatedAt: ctx.now } }, { session });
    return state(updated);
  }, { enabled: ctx.transactions });
}

export async function themeVersions(ctx: AuthedContext, crewId: ObjectId) {
  await studioTheme(ctx, crewId);
  const docs = await ctx.cols.crewThemeVersions.find({ crewId }).sort({ version: -1 }).limit(100).toArray();
  const users = await ctx.cols.users.find({ _id: { $in: docs.map((d) => d.publishedBy) }, status: { $ne: 'deleted' } }).toArray();
  return docs.map((d) => ({ version: d.version, note: d.note, publishedAt: d.publishedAt.toISOString(), publishedBy: users.find((u) => u._id.equals(d.publishedBy)) ? toUserSummary(users.find((u) => u._id.equals(d.publishedBy))!) : null, restoredFrom: d.restoredFrom, name: safeManifest(d.manifest).manifest.meta.name }));
}

export async function themeVersion(ctx: AuthedContext, crewId: ObjectId, version: number) {
  await studioTheme(ctx, crewId);
  const doc = await ctx.cols.crewThemeVersions.findOne({ crewId, version });
  if (!doc) throw notFound('Theme version');
  return safeManifest(doc.manifest).manifest;
}

export async function restoreTheme(ctx: AuthedContext, crewId: ObjectId, version: number, publish: boolean) {
  // Check both permissions before changing the draft when restoration also publishes.
  if (publish) requirePermission(await getVisibleCrewAccess(ctx, crewId), 'MANAGE_THEMES');
  const manifest = await themeVersion(ctx, crewId, version);
  return publish ? publishTheme(ctx, crewId, `Restored version ${version}`, version, manifest) : saveTheme(ctx, crewId, manifest);
}

export async function applyThemePreset(ctx: AuthedContext, crewId: ObjectId, presetId: string, mode: ThemeInstallMode) {
  if (!isPresetId(presetId)) throw badRequest('Unknown theme preset.');
  const current = await studioTheme(ctx, crewId);
  return saveTheme(ctx, crewId, applyTheme(current.draft, presetManifest(presetId), mode));
}
