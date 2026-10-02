import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/ShiftAssignSheet.js

import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { logHistory } from '../util/history.js';

import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { db } from '../firebase.js';

const ROLES = [
  'Dockhand',
  'Office',
  'Fuel Dock',
  'Maintenance',
  'Security',
  'Manager'
];

export function showShiftAssignSheet({
  date,
  shiftType,
  crewList,
  existing
}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const dateLabel = new Date(date)
    .toLocaleDateString(uiLocale(), {
      weekday: 'long',
      day: '2-digit',
      month: 'short'
    });

  sheet.innerHTML = `
    <div class="sheet-handle"></div>

    <div class="sheet-title"
         style="text-align:center;">${tr("Assign Shift")}</div>

    <div class="sh-assign-meta">
      ${escapeHtml(shiftType)} ·
      ${escapeHtml(dateLabel)}
    </div>

    <div class="sh-assign-step"
         id="shStepRole">

      <div class="help-section-title"
           style="margin:12px 0 8px;">${tr("1. Select Role")}</div>

      <div class="sh-role-grid">
        ${ROLES.map(role => `
          <button
            type="button"
            class="sh-role-btn${
              existing &&
              existing.role === role
                ? ' is-active'
                : ''
            }"
            data-role="${escapeAttr(role)}">
            ${escapeHtml(role)}
          </button>
        `).join('')}
      </div>
    </div>

    <div class="sh-assign-step"
         id="shStepCrew"
         hidden>

      <div class="help-section-title"
           style="margin:16px 0 8px;">${tr("2. Select Crew")}</div>

      <div class="sh-crew-list">
        ${
          crewList.length === 0
            ? `
              <div class="assign-empty">${tr("No crew members found.")}<br>${tr("Add crew first.")}</div>
            `
            : crewList.map(crew => `
              <button
                type="button"
                class="ao-row${
                  existing &&
                  Number(existing.crewId) ===
                  Number(crew.id)
                    ? ' is-current'
                    : ''
                }"
                data-crew-id="${crew.id}">

                <span class="ao-radio"></span>

                <span class="ao-name">
                  ${escapeHtml(crew.name)}
                  ${
                    crew.role
                      ? `
                        <span style="
                          color:var(--color-text-secondary);
                          font-weight:400;
                        ">
                          — ${escapeHtml(crew.role)}
                        </span>
                      `
                      : ''
                  }
                </span>

                ${
                  existing &&
                  Number(existing.crewId) ===
                  Number(crew.id)
                    ? '<span class="ao-check">✓</span>'
                    : ''
                }
              </button>
            `).join('')
        }
      </div>
    </div>

    <div class="ao-actions"
         style="margin-top:16px;">

      <button
        type="button"
        class="csv-btn csv-btn--cancel"
        id="shAssignCancel">${tr("Cancel")}</button>

      <button
        type="button"
        class="csv-btn csv-btn--choose"
        id="shAssignSave"
        disabled>${tr("Assign")}</button>
    </div>
  `;

  document
    .getElementById('modalRoot')
    .append(backdrop, sheet);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });

  const close = () => {
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');

    setTimeout(() => {
      backdrop.remove();
      sheet.remove();
    }, 220);
  };

  backdrop.addEventListener('click', close);

  sheet
    .querySelector('#shAssignCancel')
    .addEventListener('click', close);

  let pickedRole = existing?.role || '';

  let pickedCrew = existing
    ? crewList.find(crew =>
        Number(crew.id) ===
        Number(existing.crewId)
      ) || null
    : null;

  const stepCrew =
    sheet.querySelector('#shStepCrew');

  const saveBtn =
    sheet.querySelector('#shAssignSave');

  const updateSaveState = () => {
    saveBtn.disabled =
      !(pickedRole && pickedCrew);
  };

  if (pickedRole) {
    stepCrew.hidden = false;
  }

  updateSaveState();

  sheet
    .querySelectorAll('[data-role]')
    .forEach(button => {
      button.addEventListener('click', () => {
        pickedRole = button.dataset.role;

        sheet
          .querySelectorAll('[data-role]')
          .forEach(roleButton => {
            roleButton.classList.toggle(
              'is-active',
              roleButton === button
            );
          });

        stepCrew.hidden = false;
        updateSaveState();
      });
    });

  sheet
    .querySelectorAll('[data-crew-id]')
    .forEach(button => {
      button.addEventListener('click', () => {
        const crewId =
          Number(button.dataset.crewId);

        pickedCrew =
          crewList.find(crew =>
            Number(crew.id) === crewId
          ) || null;

        sheet
          .querySelectorAll('[data-crew-id]')
          .forEach(crewButton => {
            const selected =
              Number(
                crewButton.dataset.crewId
              ) === crewId;

            crewButton.classList.toggle(
              'is-current',
              selected
            );

            const oldCheck =
              crewButton.querySelector(
                '.ao-check'
              );

            if (oldCheck) {
              oldCheck.remove();
            }

            if (selected) {
              const check =
                document.createElement('span');

              check.className = 'ao-check';
              check.textContent = '✓';

              crewButton.appendChild(check);
            }
          });

        updateSaveState();
      });
    });

  saveBtn.addEventListener(
    'click',
    async () => {
      if (!pickedRole || !pickedCrew) {
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = tr('Saving…');

      const clientId =
        Number(store.activeClientId);

      const now = Date.now();

      const assignmentId = existing
        ? Number(existing.id)
        : now;

      try {
        if (existing) {
          await updateDoc(
            doc(
              db,
              'shift_assignments',
              String(existing._docId)
            ),
            {
              crewId:
                Number(pickedCrew.id),
              crewName:
                pickedCrew.name,
              role:
                pickedRole,
              updatedAt:
                now,
              syncTime:
                serverTimestamp()
            }
          );
        } else {
          const documentId =
            `${clientId}_${assignmentId}`;

          await setDoc(
            doc(
              db,
              'shift_assignments',
              documentId
            ),
            {
              id:
                assignmentId,
              clientId:
                clientId,
              crewId:
                Number(pickedCrew.id),
              crewName:
                pickedCrew.name,
              date:
                Number(date),
              shiftType:
                shiftType,
              role:
                pickedRole,
              notes:
                '',
              createdAt:
                now,
              updatedAt:
                now,
              syncTime:
                serverTimestamp(),
              syncedAt:
                0
            }
          );
        }

        await logHistory({
          entityType:
            'SHIFT',
          entityId:
            assignmentId,
          itemName:
            `${shiftType} shift`,
          boatId:
            0,
          action:
            existing
              ? 'UPDATED'
              : 'CREATED',
          title:
            existing
              ? 'Shift reassigned'
              : 'Shift assigned',
          detail:
            `${pickedCrew.name} (${pickedRole})`
        });

        close();

        toast(
          existing
            ? 'Shift reassigned'
            : 'Shift assigned',
          { kind: 'success' }
        );
      } catch (error) {
        console.error(
          '[shift] save failed',
          error
        );

        saveBtn.disabled = false;
        saveBtn.textContent = tr('Assign');

        toast(
          tr('Failed to save assignment'),
          { kind: 'error' }
        );
      }
    }
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(
      /[&<>"']/g,
      character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character])
    );
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}