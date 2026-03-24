import type { MolecularProperties } from '../../services/rdkitService';
import '../styles/MolecularProperties.css';

interface MolecularPropertiesDisplayProps {
    properties: MolecularProperties;
}

export function MolecularPropertiesDisplay({ properties }: MolecularPropertiesDisplayProps) {
    const getDrugLikenessColor = () => {
        switch (properties.drugLikeness) {
            case 'pass': return 'status-pass';
            case 'warning': return 'status-warning';
            case 'fail': return 'status-fail';
        }
    };

    return (
        <div className="molecular-properties">
            <div className="properties-header">
                <h3>📊 Molecular Properties</h3>
                <span className={`drug-likeness-badge ${getDrugLikenessColor()}`}>
                    {properties.drugLikeness === 'pass' ? '✓ Drug-like' :
                        properties.drugLikeness === 'warning' ? '⚠ Borderline' : '✗ Not Drug-like'}
                </span>
            </div>

            <div className="properties-grid">
                <div className="property-item">
                    <span className="property-label">Molecular Weight</span>
                    <span className="property-value">{properties.molecularWeight}</span>
                    <span className="property-unit">g/mol</span>
                </div>

                <div className="property-item">
                    <span className="property-label">LogP</span>
                    <span className="property-value">{properties.logP}</span>
                    <span className="property-unit">lipophilicity</span>
                </div>

                <div className="property-item">
                    <span className="property-label">TPSA</span>
                    <span className="property-value">{properties.tpsa}</span>
                    <span className="property-unit">Å²</span>
                </div>

                <div className="property-item">
                    <span className="property-label">H-Bond Donors</span>
                    <span className="property-value">{properties.hbd}</span>
                </div>

                <div className="property-item">
                    <span className="property-label">H-Bond Acceptors</span>
                    <span className="property-value">{properties.hba}</span>
                </div>

                <div className="property-item">
                    <span className="property-label">Rotatable Bonds</span>
                    <span className="property-value">{properties.rotatableBonds}</span>
                </div>

                <div className="property-item">
                    <span className="property-label">Heavy Atoms</span>
                    <span className="property-value">{properties.heavyAtoms}</span>
                </div>

                <div className="property-item">
                    <span className="property-label">Rings</span>
                    <span className="property-value">{properties.rings}</span>
                    <span className="property-unit">({properties.aromaticRings} aromatic)</span>
                </div>
            </div>

            <div className="lipinski-section">
                <h4>Lipinski's Rule of 5</h4>
                <div className="lipinski-rules">
                    <div className={`rule ${properties.molecularWeight <= 500 ? 'pass' : 'fail'}`}>
                        <span className="rule-icon">{properties.molecularWeight <= 500 ? '✓' : '✗'}</span>
                        <span>MW ≤ 500 ({properties.molecularWeight})</span>
                    </div>
                    <div className={`rule ${properties.logP <= 5 ? 'pass' : 'fail'}`}>
                        <span className="rule-icon">{properties.logP <= 5 ? '✓' : '✗'}</span>
                        <span>LogP ≤ 5 ({properties.logP})</span>
                    </div>
                    <div className={`rule ${properties.hbd <= 5 ? 'pass' : 'fail'}`}>
                        <span className="rule-icon">{properties.hbd <= 5 ? '✓' : '✗'}</span>
                        <span>HBD ≤ 5 ({properties.hbd})</span>
                    </div>
                    <div className={`rule ${properties.hba <= 10 ? 'pass' : 'fail'}`}>
                        <span className="rule-icon">{properties.hba <= 10 ? '✓' : '✗'}</span>
                        <span>HBA ≤ 10 ({properties.hba})</span>
                    </div>
                </div>
                <p className="violations-count">
                    {properties.lipinskiViolations === 0
                        ? '🎯 No violations - Good oral bioavailability expected'
                        : `⚠️ ${properties.lipinskiViolations} violation(s) - May have reduced bioavailability`}
                </p>
            </div>
        </div>
    );
}
