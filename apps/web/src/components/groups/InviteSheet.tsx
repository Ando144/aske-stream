import { useState } from 'react';
import { hubGroupLink } from '@aske/shared/groups';
import { HUB_URL } from '../../config';
import { renewInvite } from '../../hub/groupsClient';
import { hubErrorText } from '../../hub/errors';
import { useT } from '../../i18n';
import { confirmDialog, toast } from '../../stores/ui';
import { QrCode } from '../QrCode';
import { Sheet } from '../Sheet';

function formatCode(code: string): string {
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

export function InviteSheet({
  groupId,
  groupName,
  inviteCode,
  isOwner,
  onRenewed,
  onClose,
}: {
  groupId: string;
  groupName: string;
  inviteCode: string;
  isOwner: boolean;
  onRenewed: (code: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const link = hubGroupLink(HUB_URL, inviteCode);

  const copy = () =>
    navigator.clipboard.writeText(link).then(
      () => toast(t('groups.invite.copied')),
      () => toast(t('hub.err.internal_error'), 'error'),
    );

  const renew = async () => {
    if (!(await confirmDialog(t('groups.invite.renewConfirm'), t('groups.invite.renewLabel')))) {
      return;
    }
    setBusy(true);
    try {
      onRenewed(await renewInvite(groupId));
    } catch (err) {
      toast(hubErrorText(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet onClose={onClose} label={t('groups.invite.title', { name: groupName })}>
      <div className="sheet-body groups-invite">
        <h2>{t('groups.invite.title', { name: groupName })}</h2>
        <p className="muted small">{t('groups.invite.text')}</p>
        <QrCode text={link} label={t('groups.invite.qrLabel')} />
        <div>
          <div className="muted small">{t('groups.invite.code')}</div>
          <div className="pairing-code">{formatCode(inviteCode)}</div>
        </div>
        <div className="row wrap">
          <button className="btn primary" onClick={() => void copy()}>
            {t('groups.invite.copy')}
          </button>
          {isOwner && (
            <button className="btn" disabled={busy} onClick={() => void renew()}>
              {t('groups.invite.renew')}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
