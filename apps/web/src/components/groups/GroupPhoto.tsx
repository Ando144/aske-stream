import { useState } from 'react';
import { groupInitials } from '../../groups/look';
import { useGroupPhotoUrl } from '../../groups/photoCache';
import { useT } from '../../i18n';

/** Initials are sized relative to the square so that every size looks the same. */
const INITIALS_RATIO = 0.36;

export function GroupPhoto(props: {
  name: string;
  photoAt: number | null;
  groupId?: string;
  inviteCode?: string;
  size: number;
}) {
  const { name, size } = props;
  const t = useT();
  const url = useGroupPhotoUrl(props);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const alt = t('groups.photo.alt', { name });
  const box = { width: size, height: size };

  if (url && url !== failedUrl) {
    return (
      <img
        className="group-photo"
        src={url}
        alt={alt}
        style={box}
        onError={() => setFailedUrl(url)}
      />
    );
  }
  return (
    <span
      className="group-photo"
      role="img"
      aria-label={alt}
      style={{ ...box, fontSize: size * INITIALS_RATIO }}
    >
      {groupInitials(name)}
    </span>
  );
}
