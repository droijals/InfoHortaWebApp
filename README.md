# Horta 08031

Webapp pública amb informació diària del barri d'Horta (Barcelona): meteorologia, avisos Meteocat, Bicing i preu PVPC de l'electricitat.

Les dades es generen automàticament cada dia a les 08:00 (Europe/Madrid) mitjançant GitHub Actions i es publiquen com a JSON estàtic.


## Configuració inicial

1. A GitHub, obre **Settings → Pages** i selecciona **GitHub Actions** com a font de publicació.
2. A **Settings → Secrets and variables → Actions**, crea el secret \`METEOCAT_API_KEY\` amb la clau del Meteocat. Si encara no tens la clau, la secció d'avisos quedarà en error i les altres consultes continuaran.
3. A **Actions**, executa el workflow **Actualitzar dades Horta 08031** amb **Run workflow**.
4. Executa **Publicar webapp Horta 08031** si no s'ha publicat automàticament després d'activar Pages.

## Horari

L'actualització està programada cada dia a les 08:00 amb la zona horària \`Europe/Madrid\`. GitHub pot iniciar una execució programada amb retard per càrrega de plataforma.

## Actualització manual

El workflow es pot executar manualment des de **Actions → Actualitzar dades Horta 08031 → Run workflow**. El botó **Recarregar** del dashboard només torna a descarregar el JSON publicat; no inicia una nova consulta. Per iniciar-la directament des de la web caldrà afegir un endpoint intermedi protegit (per exemple, un Cloudflare Worker); no s'hi ha d'incloure cap token de GitHub al JavaScript públic.

## Dades i secrets

El fitxer públic \`public/data/dashboard.json\` conté les dades obtingudes, no claus d'API. No afegir mai \`.env\`, tokens o claus al directori \`public/\`.
