# Imports top 20 par federation

Objectif : importer les 20 meilleurs joueurs par federation/source, un fichier a la fois, sans scraping automatique.

Chaque fichier doit representer une seule federation ou source. Ne pas melanger FFTT, TTR, WTT, RFETM, etc. dans un meme CSV.

## Structure recommandee

```text
pgr-service/examples/federations/
  _top-20-template.csv
  wtt-top-20.csv
  ittf-top-20.csv
  fftt-top-20.csv
  ttr-top-20.csv
  rfetm-top-20.csv
  fitet-top-20.csv
  rankedin-top-20.csv
  ctta-top-20.csv
  jtta-top-20.csv
  kttf-top-20.csv
```

## Federations prioritaires

| Fichier | Source CSV | Perimetre |
| --- | --- | --- |
| `wtt-top-20.csv` | `WTT` | Top international WTT |
| `ittf-top-20.csv` | `ITTF` | Top international ITTF si distinct/disponible |
| `fftt-top-20.csv` | `FFTT` | Top France |
| `ttr-top-20.csv` | `TTR` | Top Allemagne / Click-TT / TTR |
| `rankedin-top-20.csv` | `RANKEDIN` | Angleterre ou source Rankedin selon donnees disponibles |
| `rfetm-top-20.csv` | `RFETM` | Top Espagne |
| `fitet-top-20.csv` | `FITET` | Top Italie |
| `ctta-top-20.csv` | `CTTA` | Top Chine si source accessible/legalement utilisable |
| `jtta-top-20.csv` | `JTTA` | Top Japon si source accessible/legalement utilisable |
| `kttf-top-20.csv` | `KTTF` | Top Coree du Sud si source accessible/legalement utilisable |

## Regles

- Un fichier = une source unique.
- 20 lignes maximum par fichier pour la premiere passe.
- `source`, `first_name`, `last_name` sont obligatoires.
- `external_id` est fortement recommande pour eviter les doublons.
- `rank` est recommande pour un top federation.
- `ranking_value` est recommande quand la source a des points/rating officiels.
- `ranked_at` doit correspondre a la date officielle du classement.
- `confidence_level` vaut generalement `HIGH` si la source est officielle.
- Ne pas importer de donnees sensibles : pas de date de naissance complete, adresse, email, telephone, documents personnels.

## Workflow

Copier le template :

```bash
cp pgr-service/examples/federations/_top-20-template.csv \
  pgr-service/examples/federations/fftt-top-20.csv
```

Remplir les 20 lignes depuis une source officielle ou un export autorise.

Verifier sans ecriture DB :

```bash
npm run import:csv --workspace=pgr-service -- \
  --file examples/federations/fftt-top-20.csv \
  --dry-run
```

Importer seulement apres verification :

```bash
npm run import:csv --workspace=pgr-service -- \
  --file examples/federations/fftt-top-20.csv
```

Le CLI demandera de taper `IMPORT` avant toute ecriture.

## Important

Pour la v1 fondatrice, on privilegie des imports manuels verifies. Les scrapers ou connecteurs automatiques viendront apres, source par source, seulement si les conditions techniques et legales sont claires.
