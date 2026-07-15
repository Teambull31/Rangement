# Journal des améliorations

Boucle d'audit/amélioration continue (une itération toutes les ~6 h).
Chaque entrée liste ce qui a été audité et modifié, pour ne pas refaire deux fois la même chose.

## Itération 1 — 2026-07-15

**Audit** : personnalisation quasi absente (couleurs figées), annulation d'une erreur
de saisie trop loin (Journal), tests hors du dépôt, pas de CI.

**Améliorations livrées :**
- 🎨 **Couleur personnalisable par chasseur** (Réglages) : appliquée à la carte,
  aux boutons de validation des quêtes et à la barre de duel ; synchronisée entre
  téléphones (colonne `players.color` en base).
- ⚡ **Annulation en un geste** : le toast « +XP » affiche un bouton *Annuler*
  pendant 5 s — plus besoin d'aller dans le Journal.
- 📳 **Retour haptique** léger à la validation d'une quête (Android).
- ✅ **Tests dans le dépôt** (`tests/`) avec assertions : parcours complet en mode
  local + couche de synchro face à un faux backend Supabase.
- 🤖 **CI GitHub Actions** : les deux suites tournent à chaque push.

**Pistes notées pour les prochaines itérations** (à réévaluer à chaque audit) :
- Statistiques : graphique d'XP par semaine (dataviz) dans l'onglet Duel.
- Succès/hauts faits (badges : 7 jours de série, 50 quêtes, premier rang S…).
- Récompense « surprise » : tirage au sort parmi les récompenses au lieu d'un choix fixe.
- Choix du thème visuel global (autres ambiances que le bleu système).
- Notifications de rappel (nécessite une décision : push web ou rappels locaux).
- Accessibilité : contraste des chips de priorité, tailles de touche < 44 px à vérifier.
