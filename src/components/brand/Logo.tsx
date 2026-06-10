import { cn } from "@/lib/utils";
import symbolAsset from "@/assets/revisao-symbol.asset.json";
import logoAsset from "@/assets/revisao-logo.asset.json";

type LogoProps = {
  className?: string;
  alt?: string;
};

/**
 * Símbolo "R" — para sidebars colapsadas, favicons, loaders.
 * Renderiza o monograma da Revisão Ensino Jurídico em sua proporção original,
 * sobre fundo institucional (roxo) para garantir contraste com o "R" branco.
 */
export function LogoMark({ className, alt = "Revisão Ensino Jurídico" }: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex aspect-square items-center justify-center rounded-2xl bg-primary p-2 shadow-glow",
        className,
      )}
    >
      <img
        src={symbolAsset.url}
        alt={alt}
        className="h-full w-full object-contain"
        draggable={false}
      />
    </span>
  );
}

/**
 * Logo completa — para login, splash, áreas institucionais.
 * Mantém a proporção original (a imagem já é quadrada com o lockup centralizado).
 */
export function LogoFull({ className, alt = "Revisão Ensino Jurídico" }: LogoProps) {
  return (
    <img
      src={logoAsset.url}
      alt={alt}
      className={cn("h-auto w-auto select-none rounded-2xl", className)}
      draggable={false}
    />
  );
}
