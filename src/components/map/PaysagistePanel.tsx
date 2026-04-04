'use client';

/**
 * PaysagistePanel.tsx
 * Panneau latéral complet pour le module paysagiste :
 *  - Sélection de l'élément à dessiner (catalogue par catégorie)
 *  - Liste des métrés saisis avec édition / suppression
 *  - Récapitulatif par catégorie
 *  - Export CSV
 */

import { useState, useMemo } from 'react';
import {
  CATALOGUE,
  getCategories,
  getCategorieIcone,
  formatQuantite,
  recapParCategorie,
  exportCSV,
  type ElementPaysagiste,
  type LigneMetrage,
  type Unite,
} from '@/lib/paysagiste';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaysagistePanelProps {
  lignes: LigneMetrage[];
  activeElement: ElementPaysagiste | null;
  onSelectElement: (el: ElementPaysagiste | null) => void;
  onUpdateLigne: (id: string, updates: Partial<LigneMetrage>) => void;
  onDeleteLigne: (id: string) => void;
  onClearAll: () => void;
  projetNom: string;
  onProjetNomChange: (nom: string) => void;
}

type View = 'catalogue' | 'metrage' | 'recap';

// ─── Composant principal ──────────────────────────────────────────────────────

export default function PaysagistePanel({
  lignes,
  activeElement,
  onSelectElement,
  onUpdateLigne,
  onDeleteLigne,
  onClearAll,
  projetNom,
  onProjetNomChange,
}: PaysagistePanelProps) {
  const [view, setView] = useState<View>('catalogue');
  const [searchCat, setSearchCat] = useState('');
  const [expandedCat, setExpandedCat] = useState<string | null>(getCategories()[0]);

  const categories = getCategories();
  const filteredCats = searchCat
    ? categories.filter((c) =>
        c.toLowerCase().includes(searchCat.toLowerCase()) ||
        CATALOGUE.some(
          (e) =>
            e.categorie === c &&
            e.nom.toLowerCase().includes(searchCat.toLowerCase())
        )
      )
    : categories;

  const recap = useMemo(() => recapParCategorie(lignes), [lignes]);

  const handleExportCSV = () => {
    const csv = exportCSV(lignes);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projetNom.replace(/\s/g, '_') || 'projet'}_metrage.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>

      {/* En-tête projet */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: 5 }}>
          Projet
        </div>
        <input
          type="text"
          value={projetNom}
          onChange={(e) => onProjetNomChange(e.target.value)}
          placeholder="Nom du projet…"
          style={{
            width: '100%', background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)', borderRadius: 7,
            padding: '6px 10px', fontSize: 13, color: 'var(--color-text)',
            outline: 'none',
          }}
        />
      </div>

      {/* Onglets internes */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
        {([
          { key: 'catalogue', label: 'Éléments', icon: '◫' },
          { key: 'metrage', label: `Métrés (${lignes.length})`, icon: '📋' },
          { key: 'recap', label: 'Récap', icon: '📊' },
        ] as { key: View; label: string; icon: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            style={{
              flex: 1, padding: '7px 4px', fontSize: 10, fontWeight: view === tab.key ? 700 : 400,
              cursor: 'pointer', border: 'none',
              borderBottom: `2px solid ${view === tab.key ? '#22c55e' : 'transparent'}`,
              background: 'transparent',
              color: view === tab.key ? '#22c55e' : 'var(--color-text-muted)',
              transition: 'all 0.15s', textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 13, marginBottom: 1 }}>{tab.icon}</div>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Corps scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Vue Catalogue ──────────────────────────────────────────────── */}
        {view === 'catalogue' && (
          <>
            {/* Outil actif */}
            {activeElement && (
              <div style={{
                padding: '8px 12px',
                background: `${activeElement.color}18`,
                border: `1px solid ${activeElement.color}60`,
                borderRadius: 8,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 18 }}>{activeElement.icone}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: activeElement.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeElement.nom}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                    {activeElement.geomType === 'Point' ? 'Cliquez sur la carte' :
                     activeElement.geomType === 'LineString' ? 'Tracez — dbl-clic pour finir' :
                     'Dessinez — dbl-clic pour fermer'} · {activeElement.unite}
                  </div>
                </div>
                <button
                  onClick={() => onSelectElement(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 14, padding: '2px 4px' }}
                >✕</button>
              </div>
            )}

            {/* Recherche */}
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 13, pointerEvents: 'none' }}>⌕</span>
              <input
                type="text"
                value={searchCat}
                onChange={(e) => setSearchCat(e.target.value)}
                placeholder="Filtrer les éléments…"
                style={{
                  width: '100%', paddingLeft: 28, paddingRight: 10, paddingTop: 7, paddingBottom: 7,
                  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                  borderRadius: 8, fontSize: 12, color: 'var(--color-text)', outline: 'none',
                }}
              />
            </div>

            {/* Accordion catégories */}
            {filteredCats.map((cat) => {
              const elements = CATALOGUE.filter((e) =>
                e.categorie === cat &&
                (searchCat === '' || e.nom.toLowerCase().includes(searchCat.toLowerCase()) || cat.toLowerCase().includes(searchCat.toLowerCase()))
              );
              const isOpen = expandedCat === cat || searchCat !== '';
              return (
                <div key={cat} style={{ border: '1px solid var(--color-border)', borderRadius: 9, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedCat(isOpen && searchCat === '' ? null : cat)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', background: 'var(--color-surface-2)',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{getCategorieIcone(cat)}</span>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{cat}</span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{elements.length}</span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)', transition: 'transform 0.15s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                  </button>

                  {isOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '4px 4px' }}>
                      {elements.map((el) => {
                        const isActive = activeElement?.id === el.id;
                        return (
                          <button
                            key={el.id}
                            onClick={() => onSelectElement(isActive ? null : el)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 9,
                              padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                              border: `1px solid ${isActive ? el.color : 'transparent'}`,
                              background: isActive ? `${el.color}18` : 'transparent',
                              textAlign: 'left', width: '100%',
                              transition: 'all 0.12s',
                            }}
                          >
                            <span style={{
                              width: 10, height: 10, borderRadius: '50%',
                              background: el.color, flexShrink: 0,
                            }} />
                            <span style={{ fontSize: 14, flexShrink: 0 }}>{el.icone}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? el.color : 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {el.nom}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                                {el.geomType === 'Point' ? 'point' : el.geomType === 'LineString' ? 'ligne' : 'surface'} · {el.unite}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ── Vue Métrés ────────────────────────────────────────────────── */}
        {view === 'metrage' && (
          <>
            {lignes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                Aucun métré saisi.<br/>Sélectionnez un élément dans le catalogue et dessinez sur la carte.
              </div>
            ) : (
              lignes.map((ligne) => (
                <LigneMetrageCard
                  key={ligne.id}
                  ligne={ligne}
                  onUpdate={(updates) => onUpdateLigne(ligne.id, updates)}
                  onDelete={() => onDeleteLigne(ligne.id)}
                />
              ))
            )}
          </>
        )}

        {/* ── Vue Récapitulatif ─────────────────────────────────────────── */}
        {view === 'recap' && (
          <>
            {recap.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                Aucun métré à récapituler.
              </div>
            ) : (
              <>
                {/* Résumé global */}
                <div style={{
                  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                  borderRadius: 9, padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                    Projet · {projetNom || '—'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[
                      { label: 'Catégories', val: recap.length },
                      { label: 'Éléments', val: lignes.length },
                      { label: 'Total m²', val: lignes.filter(l => l.unite === 'm²').reduce((a, l) => a + (l.quantiteManuelle ?? l.quantite), 0).toFixed(1) + ' m²' },
                      { label: 'Total ml', val: lignes.filter(l => l.unite === 'ml').reduce((a, l) => a + (l.quantiteManuelle ?? l.quantite), 0).toFixed(1) + ' ml' },
                    ].map(({ label, val }) => (
                      <div key={label} style={{ background: 'var(--color-surface)', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#22c55e', fontFamily: 'var(--font-mono)' }}>{val}</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Détail par catégorie */}
                {recap.map((cat) => (
                  <div key={cat.categorie} style={{
                    border: '1px solid var(--color-border)', borderRadius: 9, overflow: 'hidden',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', background: `${cat.color}12`,
                      borderBottom: '1px solid var(--color-border)',
                    }}>
                      <span style={{ fontSize: 14 }}>{cat.icone}</span>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: cat.color }}>{cat.categorie}</span>
                      <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{cat.lignes.length} élément{cat.lignes.length > 1 ? 's' : ''}</span>
                    </div>

                    {/* Totaux par unité */}
                    <div style={{ padding: '6px 12px 4px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(Object.entries(cat.totalParUnite) as [Unite, number][])
                        .filter(([, v]) => v > 0)
                        .map(([unite, total]) => (
                          <span key={unite} style={{
                            fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
                            color: cat.color, background: `${cat.color}14`,
                            padding: '2px 8px', borderRadius: 20,
                          }}>
                            {formatQuantite(total, unite)}
                          </span>
                        ))}
                    </div>

                    {/* Lignes détail */}
                    <div style={{ padding: '4px 12px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {cat.lignes.map((l) => (
                        <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nom}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text)', flexShrink: 0 }}>
                            {formatQuantite(l.quantiteManuelle ?? l.quantite, l.unite)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Footer actions */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8 }}>
        <button
          onClick={handleExportCSV}
          disabled={lignes.length === 0}
          style={{
            flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            cursor: lignes.length === 0 ? 'not-allowed' : 'pointer',
            border: '1px solid var(--color-border)',
            background: lignes.length === 0 ? 'transparent' : 'var(--color-surface-2)',
            color: lignes.length === 0 ? 'var(--color-text-muted)' : '#22c55e',
            opacity: lignes.length === 0 ? 0.4 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          ↓ CSV
        </button>
        <button
          onClick={() => { if (confirm('Effacer tous les métrés ?')) onClearAll(); }}
          disabled={lignes.length === 0}
          style={{
            padding: '8px 12px', borderRadius: 8, fontSize: 12,
            cursor: lignes.length === 0 ? 'not-allowed' : 'pointer',
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: lignes.length === 0 ? 'var(--color-text-muted)' : '#ef4444',
            opacity: lignes.length === 0 ? 0.4 : 1,
          }}
        >
          ✕ Tout effacer
        </button>
      </div>
    </div>
  );
}

// ─── Carte d'une ligne de métré ───────────────────────────────────────────────

function LigneMetrageCard({
  ligne,
  onUpdate,
  onDelete,
}: {
  ligne: LigneMetrage;
  onUpdate: (updates: Partial<LigneMetrage>) => void;
  onDelete: () => void;
}) {
  // Note : toujours visible, sauvegarde au blur (onBlur) ou Entrée
  const [labelVal, setLabelVal] = useState(ligne.label ?? '');
  // Quantité manuelle : visible si override actif, sinon affichée en lecture
  const [qManuelle, setQManuelle] = useState(
    ligne.quantiteManuelle !== undefined ? String(ligne.quantiteManuelle) : ''
  );
  const [qEditing, setQEditing] = useState(false);

  const displayQ = ligne.quantiteManuelle !== undefined ? ligne.quantiteManuelle : ligne.quantite;
  const hasOverride = ligne.quantiteManuelle !== undefined;

  // Sauvegarde de la note (onBlur ou Entrée)
  const saveLabel = () => {
    const trimmed = labelVal.trim();
    if (trimmed !== (ligne.label ?? '')) {
      onUpdate({ label: trimmed || undefined });
    }
  };

  const handleLabelKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.currentTarget.blur(); }
    if (e.key === 'Escape') { setLabelVal(ligne.label ?? ''); e.currentTarget.blur(); }
  };

  // Sauvegarde de la quantité manuelle
  const saveQuantite = () => {
    if (qManuelle === '') {
      onUpdate({ quantiteManuelle: undefined });
    } else {
      const qm = parseFloat(qManuelle);
      if (!isNaN(qm) && qm > 0) onUpdate({ quantiteManuelle: qm });
      else setQManuelle(ligne.quantiteManuelle !== undefined ? String(ligne.quantiteManuelle) : '');
    }
    setQEditing(false);
  };

  const handleQKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') saveQuantite();
    if (e.key === 'Escape') {
      setQManuelle(ligne.quantiteManuelle !== undefined ? String(ligne.quantiteManuelle) : '');
      setQEditing(false);
    }
  };

  return (
    <div style={{
      background: 'var(--color-surface-2)',
      border: `1px solid ${ligne.color}40`,
      borderRadius: 9,
      overflow: 'hidden',
    }}>

      {/* En-tête : nom + quantité + supprimer */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px 6px',
        background: `${ligne.color}10`,
        borderBottom: '1px solid var(--color-border)',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: ligne.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ligne.nom}
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{ligne.categorie}</div>
        </div>
        <button
          onClick={onDelete}
          title="Supprimer"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: '2px 6px', borderRadius: 4, lineHeight: 1 }}
        >✕</button>
      </div>

      {/* Corps : quantité + note */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* Ligne quantité */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 52, flexShrink: 0 }}>Quantité</span>

          {qEditing ? (
            <input
              type="number"
              autoFocus
              value={qManuelle}
              min={0}
              step={ligne.unite === 'u' ? 1 : 0.01}
              onChange={(e) => setQManuelle(e.target.value)}
              onBlur={saveQuantite}
              onKeyDown={handleQKey}
              placeholder={ligne.quantite.toFixed(ligne.unite === 'u' ? 0 : 2)}
              style={{
                flex: 1, background: 'var(--color-surface)',
                border: `1px solid ${ligne.color}80`,
                borderRadius: 5, padding: '3px 7px', fontSize: 12,
                color: 'var(--color-text)', outline: 'none', fontFamily: 'var(--font-mono)',
              }}
            />
          ) : (
            <button
              onClick={() => { setQManuelle(hasOverride ? String(ligne.quantiteManuelle) : ''); setQEditing(true); }}
              title={hasOverride ? 'Modifier la quantité (override actif)' : 'Saisir une quantité manuelle'}
              style={{
                flex: 1, textAlign: 'left', background: 'none',
                border: `1px solid ${hasOverride ? ligne.color + '60' : 'var(--color-border)'}`,
                borderRadius: 5, padding: '3px 7px', fontSize: 13,
                fontFamily: 'var(--font-mono)', fontWeight: 700,
                color: hasOverride ? ligne.color : 'var(--color-text)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {formatQuantite(displayQ, ligne.unite)}
              {hasOverride && <span style={{ fontSize: 9, opacity: 0.7 }}>✎</span>}
            </button>
          )}

          {hasOverride && !qEditing && (
            <button
              onClick={() => { setQManuelle(''); onUpdate({ quantiteManuelle: undefined }); }}
              title="Restaurer la valeur mesurée"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 11, padding: '2px 4px' }}
            >↩</button>
          )}
        </div>

        {qEditing && (
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', paddingLeft: 58 }}>
            Mesurée : {ligne.quantite.toFixed(ligne.unite === 'u' ? 0 : 2)} {ligne.unite} — laisser vide pour restaurer · Entrée pour valider
          </div>
        )}

        {/* Champ note toujours visible */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 52, flexShrink: 0, paddingTop: 5 }}>Note</span>
          <input
            type="text"
            value={labelVal}
            onChange={(e) => setLabelVal(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={handleLabelKey}
            placeholder="Repère, localisation, précision… (→ CSV)"
            style={{
              flex: 1,
              background: labelVal ? 'var(--color-surface)' : 'transparent',
              border: `1px solid ${labelVal ? 'var(--color-border)' : 'var(--color-border)'}`,
              borderRadius: 5, padding: '4px 8px',
              fontSize: 12, color: 'var(--color-text)',
              outline: 'none',
              fontStyle: labelVal ? 'normal' : 'italic',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#22c55e'; e.currentTarget.style.background = 'var(--color-surface)'; }}
            onBlurCapture={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
          />
        </div>

        {/* Indicateur export */}
        {labelVal && (
          <div style={{ fontSize: 10, color: '#22c55e', paddingLeft: 58, opacity: 0.8 }}>
            ✓ inclus dans l'export CSV
          </div>
        )}

      </div>
    </div>
  );
}
