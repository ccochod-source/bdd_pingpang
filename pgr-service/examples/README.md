# Import CSV manuel PGR

Ce dossier contient des CSV normalisés prêts à être transformés en `NormalizedExternalPlayer[]`, puis importés via `ImportsService.importNormalizedPlayers`.

Commande recommandée :

```bash
npm run import:csv -- --file examples/top-players.csv --dry-run
```

Importer réellement seulement après vérification :

```bash
npm run import:csv -- --file examples/top-players.csv
```

Le script demandera de taper `IMPORT` avant toute écriture en base.

## Colonnes

| Colonne | Obligatoire | Format attendu | Exemple |
| --- | --- | --- | --- |
| `source` | Oui | Source PGR unique par fichier. Valeurs : `WTT`, `ITTF`, `FFTT`, `TTR`, `RANKEDIN`, `RFETM`, `FITET`, `CTTA`, `JTTA`, `KTTF`, `PING_PANG`, `QUESTIONNAIRE`, `MANUAL`. | `WTT` |
| `external_id` | Non, fortement recommandé | Identifiant stable dans la source. Sert a eviter les doublons via `source + external_id`. | `WTT-12345` |
| `external_url` | Non | URL publique de la fiche source, si disponible. | `https://example.org/player/12345` |
| `first_name` | Oui | Prenom normalise. | `Ma` |
| `last_name` | Oui | Nom normalise. | `Long` |
| `display_name` | Non | Nom public affiche. Si vide : `first_name last_name`. | `Ma Long` |
| `country_code` | Non, recommande | Code pays ISO alpha-2 en deux lettres. | `CN` |
| `gender` | Non | Valeur libre courte selon source, par exemple `M`, `F`, `X`. | `M` |
| `category` | Non | Categorie sportive, par exemple `SENIOR`, `JUNIOR`, `CADET`, `VETERAN`, `PARA`. | `SENIOR` |
| `club_name` | Non | Nom du club. Laisser vide si inconnu ou non pertinent. | `Paris XV Tennis de Table` |
| `club_country_code` | Non | Code pays ISO alpha-2 du club. Utilise seulement si `club_name` est rempli. | `FR` |
| `ranking_value` | Non | Points/rating source. Nombre positif. Pour FFTT : points. Pour TTR : rating TTR. Pour WTT : points si connus. | `1850` |
| `rank` | Non | Rang entier positif. Recommande pour WTT/ITTF et classements nationaux. | `1` |
| `ranked_at` | Non | Date du classement au format `YYYY-MM-DD`. A renseigner si un `rank` ou `ranking_value` est present. | `2026-05-01` |
| `confidence_level` | Non | Niveau de confiance : `HIGH`, `MEDIUM`, `LOW`. Par defaut cote import : `MEDIUM`. | `HIGH` |
| `total_players` | Non | Nombre total de joueurs dans le classement, entier positif. Utile pour les sources rank-based nationales. | `1000` |

Regles importantes :

- `source`, `first_name` et `last_name` sont obligatoires.
- `ranked_at`, `confidence_level` et `total_players` ne doivent etre renseignes que si `rank` ou `ranking_value` est present.
- Si `external_id` est absent, le service tente un fallback prudent sur `first_name + last_name + country_code`. En cas d'ambiguite, l'import echoue.
- Un fichier CSV doit contenir une seule source logique. Pour un top WTT et un top FFTT, utiliser deux fichiers differents.

## Exemple minimal

```csv
source,external_id,external_url,first_name,last_name,display_name,country_code,gender,category,club_name,club_country_code,ranking_value,rank,ranked_at,confidence_level,total_players
WTT,WTT-001,,Ma,Long,Ma Long,CN,M,SENIOR,,,8500,1,2026-05-01,HIGH,1000
FFTT,FFTT-001,,Camille,Roux,Camille Roux,FR,F,SENIOR,Paris XV Tennis de Table,FR,1850,,2026-04-01,HIGH,
TTR,TTR-001,,Anna,Schmidt,Anna Schmidt,DE,F,SENIOR,,,,1830,,2026-04-15,HIGH,
```

Cet exemple couvre :

- un joueur WTT initialise avec `rank`,
- un joueur FFTT initialise avec `ranking_value`,
- un joueur sans club, avec les colonnes club laissees vides.

## Securite

- Toujours lancer `--dry-run` avant un import reel.
- Verifier que le CSV contient une seule source (`WTT`, `FFTT`, `TTR`, etc.).
- Importer seulement apres confirmation explicite dans le CLI.
- Ne jamais importer de donnees sensibles inutiles : pas de date de naissance complete, pas d'adresse, pas d'email, pas de telephone, pas de documents personnels.
- Ne pas utiliser ce CSV pour scraper ou stocker des donnees non autorisees. Il doit contenir uniquement des donnees deja normalisees et legitimes pour PGR.

## Top 20 par federation

Pour les imports manuels de top joueurs, utiliser un fichier par source/federation. C'est plus simple a auditer et cela evite les erreurs de source.

Les imports top 20 par federation doivent etre prepares dans :

```text
pgr-service/examples/federations/
```

Noms recommandes :

- `wtt-top-20.csv`
- `ittf-top-20.csv`
- `fftt-top-20.csv`
- `ttr-top-20.csv`
- `rfetm-top-20.csv`
- `fitet-top-20.csv`

Chaque fichier doit garder la meme structure de colonnes que `top-players.csv`, avec une seule valeur `source` sur toutes les lignes.

Voir aussi : `pgr-service/examples/federations/README.md`.
