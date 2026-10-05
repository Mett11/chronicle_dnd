import React, { useState } from 'react';
import { Shield, Cookie, FileText, X, CheckCircle, ExternalLink } from 'lucide-react';

export type LegalTab = 'privacy' | 'cookie' | 'terms';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: LegalTab;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<LegalTab>(defaultTab);

  React.useEffect(() => {
    if (isOpen && defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-[#0e0c12] border border-[#2a241b] rounded-xl shadow-2xl flex flex-col overflow-hidden text-[#e8decb]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title and Tabs */}
        <div className="p-4 sm:p-6 border-b border-[#241f17] bg-[#141019] shrink-0">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2.5">
              <Shield size={20} className="text-[#d4af37]" />
              <h2
                className="text-lg sm:text-xl font-bold text-[#f5ede0] tracking-wide"
                style={{ fontFamily: "'Cinzel', Georgia, serif" }}
              >
                Note Legali, Privacy & Conformità GDPR
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#9c8973] hover:text-[#f5ede0] hover:bg-[#201c26] transition-colors cursor-pointer"
              title="Chiudi"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-[#241f17] -mb-4 pb-2 sm:pb-3 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer shrink-0 ${
                activeTab === 'privacy'
                  ? 'bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/40'
                  : 'text-[#9c8973] hover:text-[#e8decb] hover:bg-[#1a1622]'
              }`}
            >
              <Shield size={14} />
              <span>Informativa Privacy (GDPR)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cookie')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer shrink-0 ${
                activeTab === 'cookie'
                  ? 'bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/40'
                  : 'text-[#9c8973] hover:text-[#e8decb] hover:bg-[#1a1622]'
              }`}
            >
              <Cookie size={14} />
              <span>Cookie Policy</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('terms')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer shrink-0 ${
                activeTab === 'terms'
                  ? 'bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/40'
                  : 'text-[#9c8973] hover:text-[#e8decb] hover:bg-[#1a1622]'
              }`}
            >
              <FileText size={14} />
              <span>Termini & Disclaimer D&D</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-7 text-xs sm:text-sm leading-relaxed text-[#c7baa7] space-y-6">
          {/* TAB 1: PRIVACY POLICY (GDPR) */}
          {activeTab === 'privacy' && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-3.5 rounded-lg bg-[#181320] border border-[#32273d] flex items-start gap-3">
                <CheckCircle size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-[#dcd1c2] space-y-1">
                  <p className="font-semibold text-emerald-300">
                    Conformità al Regolamento Generale sulla Protezione dei Dati (GDPR - UE 2016/679)
                  </p>
                  <p className="text-[#a89a87]">
                    Questa informativa descrive con trasparenza come vengono raccolti, protetti e gestiti i tuoi dati su Chronicle. Nessun dato viene venduto o ceduto a terzi per scopi promozionali.
                  </p>
                </div>
              </div>

              <section className="space-y-2">
                <h3 className="font-serif font-bold text-sm sm:text-base text-[#f5ede0]">
                  1. Titolare del Trattamento e Contatti
                </h3>
                <p>
                  L’applicazione Chronicle è gestita per l’organizzazione e la narrazione condivisa di campagne di gioco di ruolo da tavolo. Per qualsiasi richiesta relativa alla privacy o all’esercizio dei propri diritti (accesso, modifica, cancellazione completa dei dati), puoi contattare l’amministratore all’indirizzo email associato alla campagna o all’amministrazione di sistema.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-serif font-bold text-sm sm:text-base text-[#f5ede0]">
                  2. Categorie di Dati Personali Trattati
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-[#b8a994]">
                  <li>
                    <strong className="text-[#e8decb]">Dati di autenticazione:</strong> indirizzo email e identificativo account forniti tramite il servizio di login OAuth (Google), necessari unicamente per l’identificazione del giocatore o DM.
                  </li>
                  <li>
                    <strong className="text-[#e8decb]">Dati di profilo di gioco:</strong> nome del personaggio, avatar scelto, colore assegnato al profilo e preferenze visive di tema.
                  </li>
                  <li>
                    <strong className="text-[#e8decb]">Dati narrativi di campagna:</strong> note di sessione, capitoli, luoghi, entità, registrazioni o immagini di mappa caricate liberamente dall’utente per lo svolgimento delle sessioni di gioco.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="font-serif font-bold text-sm sm:text-base text-[#f5ede0]">
                  3. Finalità del Trattamento e Base Giuridica
                </h3>
                <p>
                  I dati personali sono trattati esclusivamente per:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[#b8a994]">
                  <li>Consentire l’accesso e la sincronizzazione in tempo reale delle sessioni tra DM e giocatori della medesima campagna.</li>
                  <li>Garantire la sicurezza del servizio e prevenire abusi o accessi non autorizzati alle campagne private.</li>
                </ul>
                <p className="text-xs text-[#a39480] italic">
                  Base giuridica: Esecuzione di misure precontrattuali o contrattuali richieste dall'interessato (Art. 6, par. 1, lett. b GDPR) e legittimo interesse alla sicurezza del servizio (Art. 6, par. 1, lett. f GDPR).
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-serif font-bold text-sm sm:text-base text-[#f5ede0]">
                  4. Sicurezza e Conservazione dei Dati
                </h3>
                <p>
                  I dati sono conservati su infrastrutture cloud sicure con crittografia in transito (protocolli HTTPS/TLS) e a riposo. I dati permangono memorizzati fino alla richiesta di cancellazione da parte dell’utente o fino all’eliminazione della relativa campagna da parte del Dungeon Master.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-serif font-bold text-sm sm:text-base text-[#f5ede0]">
                  5. Diritti dell'Interessato (Artt. 15-22 GDPR)
                </h3>
                <p>
                  In qualità di utente interessato, godi del diritto di:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[#b8a994]">
                  <li><strong>Accesso:</strong> richiedere copia dei dati personali in nostro possesso.</li>
                  <li><strong>Rettifica:</strong> aggiornare o correggere i propri dati (puoi farlo anche autonomamente dal menu Impostazioni & Profilo).</li>
                  <li><strong>Cancellazione (Diritto all'Oblio):</strong> richiedere l’eliminazione totale del proprio profilo, delle campagne o delle sessioni registrate.</li>
                  <li><strong>Portabilità dei dati:</strong> esportare i file e i dati di backup delle tue sessioni in formato aperto JSON.</li>
                  <li><strong>Reclamo:</strong> proporre reclamo all'Autorità Garante per la Protezione dei Dati Personali qualora si ritenga violata la normativa.</li>
                </ul>
              </section>
            </div>
          )}

          {/* TAB 2: COOKIE POLICY */}
          {activeTab === 'cookie' && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-3.5 rounded-lg bg-[#181320] border border-[#32273d] flex items-start gap-3">
                <Cookie size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-[#dcd1c2] space-y-1">
                  <p className="font-semibold text-amber-300">
                    Utilizzo esclusivo di Cookie Tecnici e Archiviazione Locale
                  </p>
                  <p className="text-[#a89a87]">
                    Chronicle NON utilizza cookie di profilazione commerciale, tracker pubblicitari o pixel di monitoraggio di terze parti.
                  </p>
                </div>
              </div>

              <section className="space-y-2">
                <h3 className="font-serif font-bold text-sm sm:text-base text-[#f5ede0]">
                  1. Cosa sono i Cookie e le Memorie Locali
                </h3>
                <p>
                  I cookie e gli strumenti di archiviazione web (come LocalStorage e IndexedDB) sono piccoli frammenti di informazione salvati temporaneamente nel tuo browser per consentire al sito di ricordare le tue preferenze e mantenere aperto il tuo accesso durante la navigazione.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-serif font-bold text-sm sm:text-base text-[#f5ede0]">
                  2. Quali Cookie e Storage vengono utilizzati su Chronicle
                </h3>
                <div className="space-y-3 pt-1">
                  <div className="p-3 rounded bg-[#131017] border border-[#26202c]">
                    <div className="flex items-center justify-between text-xs font-mono font-semibold text-[#f5ede0]">
                      <span>Cookie Tecnici di Autenticazione (Sessione)</span>
                      <span className="text-emerald-400">Indispensabili</span>
                    </div>
                    <p className="text-xs text-[#a89a87] mt-1">
                      Mantengono sicuro e attivo il login del tuo profilo e validano i token di accesso per permetterti di visualizzare la tua campagna senza dover inserire le credenziali ad ogni pagina.
                    </p>
                  </div>

                  <div className="p-3 rounded bg-[#131017] border border-[#26202c]">
                    <div className="flex items-center justify-between text-xs font-mono font-semibold text-[#f5ede0]">
                      <span>Archiviazione Locale (LocalStorage / IndexedDB)</span>
                      <span className="text-emerald-400">Funzionali</span>
                    </div>
                    <p className="text-xs text-[#a89a87] mt-1">
                      Memorizzano le preferenze grafiche dell'interfaccia (es. tema scuro/pergamena, capitolo attivo) e velocizzano il caricamento offline di mappe e registri di sessione.
                    </p>
                  </div>

                  <div className="p-3 rounded bg-[#131017] border border-[#26202c]">
                    <div className="flex items-center justify-between text-xs font-mono font-semibold text-[#f5ede0]">
                      <span>Cookie di Terze Parti o Pubblicitari</span>
                      <span className="text-red-400">NON UTILIZZATI (0%)</span>
                    </div>
                    <p className="text-xs text-[#a89a87] mt-1">
                      Chronicle è un'applicazione libera da pubblicità: non sono presenti cookie di tracciamento commerciale, analytics invasivi, Facebook Pixel, Google Ads o script di profilazione a pagamento.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="font-serif font-bold text-sm sm:text-base text-[#f5ede0]">
                  3. Consenso ai Cookie
                </h3>
                <p>
                  In conformità alla Direttiva Europea 2002/58/CE (modificata dalla Direttiva 2009/136/CE) e alle Linee Guida del Garante Privacy italiano, per l'installazione di <strong>cookie esclusivamente tecnici e strettamente necessari</strong> non è richiesto il preventivo consenso dell'utente tramite banner bloccante, poiché indispensabili alla corretta fornitura del servizio richiesto.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-serif font-bold text-sm sm:text-base text-[#f5ede0]">
                  4. Come gestire o eliminare i cookie
                </h3>
                <p>
                  Puoi in ogni momento visualizzare, bloccare o cancellare i dati archiviati e i cookie direttamente dalle impostazioni di riservatezza del tuo browser (es. Chrome, Firefox, Safari, Edge). La disabilitazione completa dei cookie tecnici potrebbe tuttavia impedire l'autenticazione all'app.
                </p>
              </section>
            </div>
          )}

          {/* TAB 3: TERMINI & DISCLAIMER D&D */}
          {activeTab === 'terms' && (
            <div className="space-y-6 animate-fade-in">
              <section className="space-y-2">
                <h3 className="font-serif font-bold text-sm sm:text-base text-[#f5ede0]">
                  1. Descrizione del Servizio
                </h3>
                <p>
                  Chronicle è uno strumento digitale indipendente progettato per facilitare la stesura di cronache, la gestione di sessioni, mappe e schede per campagne di gioco di ruolo da tavolo basate sul sistema D&D 5E.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-serif font-bold text-sm sm:text-base text-[#f5ede0]">
                  2. Proprietà Intellettuale dei Contenuti Narrativi
                </h3>
                <p>
                  Tutti i testi originali, resoconti, appunti di sessione, schede di personaggi e immagini caricate dai Dungeon Master e dai giocatori restano di esclusiva proprietà intellettuale degli utenti che li hanno generati. Chronicle non rivendica alcun diritto di copyright sui tuoi scritti di campagna.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-serif font-bold text-sm sm:text-base text-[#f5ede0]">
                  3. Disclaimer Ufficiale Wizards of the Coast & OGL / SRD
                </h3>
                <div className="p-3.5 rounded bg-[#131017] border border-[#2a241b] text-xs space-y-2 text-[#b0a18c]">
                  <p>
                    Chronicle è un progetto indipendente e non è affiliato, sponsorizzato, supportato o approvato da Wizards of the Coast LLC.
                  </p>
                  <p>
                    <em>Dungeons & Dragons</em>, <em>D&D</em>, i relativi loghi, marchi commerciali e nomi di mostri o classi sono proprietà esclusiva di Wizards of the Coast LLC, una sussidiaria di Hasbro, Inc. Qualsiasi utilizzo di termini di gioco di ruolo è effettuato in conformità con la <strong>Open Gaming License (OGL v1.0a)</strong> e con il <strong>System Reference Document (SRD 5.1)</strong> rilasciato sotto licenza Creative Commons CC-BY-4.0.
                  </p>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="font-serif font-bold text-sm sm:text-base text-[#f5ede0]">
                  4. Limitazione di Responsabilità
                </h3>
                <p>
                  Il servizio è fornito "nello stato in cui si trova" per finalità ricreative e di intrattenimento tra gruppi di gioco. Consigliamo di effettuare periodicamente il download del backup JSON della propria campagna dal menu Impostazioni per garantire sempre la massima tutela delle proprie cronache.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#241f17] bg-[#141019] flex items-center justify-between text-xs text-[#8c7b68] shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Versione 1.0 &bull; Conforme alle norme UE</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#201c26] hover:bg-[#2c2635] text-[#e8decb] hover:text-[#f5ede0] border border-[#362f40] transition-colors cursor-pointer font-medium"
          >
            Ho compreso e Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
