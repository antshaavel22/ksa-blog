import { AuthorProfile } from "@/lib/authors";
import Image from "next/image";
import Link from "next/link";

type Lang = "et" | "ru" | "en";

interface Props {
  author: AuthorProfile;
  lang?: Lang;
  variant?: "author" | "reviewer";
}

const LABEL = {
  author: { et: "Autor", ru: "Автор", en: "Author" },
  reviewer: { et: "Ekspertkommentaar", ru: "Экспертный комментарий", en: "Expert review" },
  profile: { et: "Vaata profiili →", ru: "Смотреть профиль →", en: "View profile →" },
};

export default function AuthorBio({ author, lang = "et", variant = "author" }: Props) {
  const bio = author.bio[lang];
  const role = author.role[lang];
  const credentials = author.credentials?.[lang];
  const label = LABEL[variant][lang];
  const profileLabel = LABEL.profile[lang];

  return (
    <div
      style={{
        borderTop: "1px solid #e6e6e6",
        paddingTop: "28px",
        marginTop: "32px",
        display: "flex",
        gap: "20px",
        alignItems: "flex-start",
      }}
    >
      {/* Avatar */}
      <div style={{ flexShrink: 0 }}>
        {author.avatarUrl ? (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              overflow: "hidden",
              position: "relative",
              background: "#f5f3ee",
            }}
          >
            <Image
              src={author.avatarUrl}
              alt={author.displayName}
              fill
              sizes="72px"
              style={{ objectFit: "cover" }}
            />
          </div>
        ) : (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "#87be23",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 26,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {author.displayName.charAt(0)}
          </div>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#87be23",
            margin: "0 0 4px",
          }}
        >
          {label}
        </p>
        <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 16, color: "#1a1a1a" }}>
          {author.displayName}
        </p>
        <p style={{ margin: "0 0 2px", fontSize: 13, color: "#5a6b6c" }}>{role}</p>
        {credentials && (
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#9a9a9a" }}>{credentials}</p>
        )}
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#3a3a3a", lineHeight: 1.6 }}>
          {bio}
        </p>
        {author.profileUrl && (
          <Link
            href={author.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 13,
              color: "#87be23",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            {profileLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
