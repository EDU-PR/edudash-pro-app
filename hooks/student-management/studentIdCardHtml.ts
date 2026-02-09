/**
 * Student ID card HTML template generation.
 *
 * Produces a printable HTML page with credit-card-style ID tags
 * ready for expo-print / PDF export.
 */

import type { Student } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getStudentInitials(
  student: Pick<Student, 'first_name' | 'last_name'>,
): string {
  return (
    `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase() || 'ST'
  );
}

// ---------------------------------------------------------------------------
// HTML builder
// ---------------------------------------------------------------------------

export function buildPrintableStudentIdCardsHtml(params: {
  schoolName?: string | null;
  schoolType?: string | null;
  students: Student[];
}): string {
  const { schoolName, schoolType, students } = params;
  const safeSchool = escapeHtml(schoolName?.trim() || 'EduDash Pro School');
  const safeType = escapeHtml((schoolType || 'school').toUpperCase());
  const generatedAt = new Date().toLocaleString();

  const cards = students
    .map((student) => {
      const fullName = escapeHtml(
        `${student.first_name} ${student.last_name}`.trim(),
      );
      const studentCode = escapeHtml(
        (student.student_id || student.id || '').toUpperCase().slice(0, 18),
      );
      const className = escapeHtml(
        student.class_name || student.age_group_name || 'Unassigned',
      );
      const parentName = escapeHtml(student.parent_name || 'Not linked');
      const ageText = `${student.age_years}y`;
      const initials = escapeHtml(getStudentInitials(student));
      const avatarUrl = student.avatar_url
        ? escapeHtml(student.avatar_url)
        : '';
      const status = escapeHtml((student.status || 'active').toUpperCase());

      return `
      <article class="card">
        <div class="hole"></div>
        <div class="ribbon"></div>
        <header class="card-top">
          <div class="school">${safeSchool}</div>
          <div class="type">${safeType}</div>
        </header>
        <div class="body">
          <div class="avatar-wrap">
            ${
              avatarUrl
                ? `<img class="avatar" src="${avatarUrl}" alt="${fullName}" />`
                : `<div class="avatar-fallback">${initials}</div>`
            }
          </div>
          <div class="meta">
            <div class="name">${fullName}</div>
            <div class="row">ID: <strong>${studentCode || 'N/A'}</strong></div>
            <div class="row">Class: <strong>${className}</strong></div>
            <div class="row">Age: <strong>${escapeHtml(ageText)}</strong></div>
            <div class="row">Guardian: <strong>${parentName}</strong></div>
          </div>
        </div>
        <footer class="footer">
          <span class="status">${status}</span>
          <span class="serial">#${escapeHtml(student.id.slice(0, 8).toUpperCase())}</span>
        </footer>
      </article>
    `;
    })
    .join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Student ID Cards</title>
        <style>
          :root {
            --card-w: 85.6mm;
            --card-h: 54mm;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: "Avenir Next", "Segoe UI", sans-serif;
            background: #eef3ff;
            color: #0f172a;
          }
          .page {
            padding: 10mm;
          }
          .page-header {
            margin-bottom: 8mm;
          }
          .title {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: 0.02em;
          }
          .subtitle {
            color: #334155;
            font-size: 12px;
            margin-top: 4px;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(var(--card-w), 1fr));
            gap: 6mm;
          }
          .card {
            width: var(--card-w);
            min-height: var(--card-h);
            border-radius: 14px;
            background: linear-gradient(135deg, #0b1730 0%, #1e3a8a 65%, #1d4ed8 100%);
            color: #f8fafc;
            padding: 10px 10px 8px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 10px 22px rgba(2, 6, 23, 0.35);
          }
          .hole {
            position: absolute;
            right: 10px;
            top: 9px;
            width: 12px;
            height: 12px;
            border-radius: 999px;
            border: 2px solid rgba(255,255,255,0.35);
            background: rgba(2, 6, 23, 0.45);
          }
          .ribbon {
            position: absolute;
            right: -24px;
            top: -16px;
            width: 92px;
            height: 92px;
            border-radius: 999px;
            background: radial-gradient(circle at center, rgba(250,204,21,0.24), rgba(250,204,21,0) 70%);
          }
          .card-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            gap: 8px;
          }
          .school {
            font-size: 10px;
            font-weight: 700;
            line-height: 1.2;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            max-width: 70%;
          }
          .type {
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.03em;
            background: rgba(59,130,246,0.35);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 999px;
            padding: 2px 6px;
            white-space: nowrap;
          }
          .body {
            display: flex;
            gap: 8px;
          }
          .avatar-wrap {
            width: 56px;
            min-width: 56px;
            height: 56px;
            border-radius: 12px;
            background: rgba(255,255,255,0.16);
            border: 1px solid rgba(255,255,255,0.3);
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .avatar {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .avatar-fallback {
            font-size: 18px;
            font-weight: 800;
            color: #e2e8f0;
          }
          .meta {
            flex: 1;
            min-width: 0;
          }
          .name {
            font-size: 12px;
            font-weight: 800;
            margin-bottom: 3px;
            line-height: 1.2;
          }
          .row {
            font-size: 9.5px;
            line-height: 1.25;
            opacity: 0.95;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .footer {
            margin-top: 8px;
            padding-top: 6px;
            border-top: 1px solid rgba(255,255,255,0.28);
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            font-size: 9px;
          }
          .status {
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.25);
            background: rgba(5,150,105,0.25);
          }
          .serial {
            letter-spacing: 0.08em;
            font-weight: 700;
            opacity: 0.9;
          }
          @media print {
            body {
              background: #fff;
            }
            .page {
              padding: 0;
            }
            .page-header {
              margin: 0 0 6mm 0;
            }
            .title {
              font-size: 16px;
            }
            .subtitle {
              font-size: 10px;
            }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <header class="page-header">
            <div class="title">Student ID Tags</div>
            <div class="subtitle">${safeSchool} • ${students.length} cards • Generated ${escapeHtml(generatedAt)}</div>
          </header>
          <section class="grid">${cards}</section>
        </main>
      </body>
    </html>
  `;
}
