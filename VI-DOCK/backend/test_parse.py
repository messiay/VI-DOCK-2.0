import re

with open(r'C:\Users\user\AppData\Local\Temp\vidock_xxtirosj\output.sd') as f:
    content = f.read()

compounds = content.split('$$$$')
scores = []
rank = 0

for compound in compounds:
    if not compound.strip():
        continue
    
    if '<SCORE>' in compound:
        try:
            score_match = re.search(r'<SCORE>\s+([-\d.]+)', compound)
            if score_match:
                score = float(score_match.group(1))
                rank += 1
                scores.append({
                    'Mode': rank,
                    'Affinity (kcal/mol)': score,
                    'Engine': 'rDock'
                })
        except Exception as e:
            print(f"Error parsing: {e}")
            continue

print(f"Total scores found: {len(scores)}")
print("First 5 scores:")
for s in scores[:5]:
    print(s)
