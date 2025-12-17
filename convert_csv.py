import csv
import json
import os

csv_path = '毛泽东语录.csv'
json_path = 'quotes.json'

quotes = []
id_counter = 1

if os.path.exists(csv_path):
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        # Skip header if it exists (Row 1 and 2 seem to be headers or junk based on previous view)
        # Row 1: "表格 1"
        # Row 2: ",中文,,英文,,,"
        next(reader, None)
        next(reader, None)
        
        for row in reader:
            if len(row) > 1:
                content = row[1].strip()
                if content:
                    quotes.append({
                        "id": id_counter,
                        "content": content,
                        "image_type": "portrait_smiling" # Default for now
                    })
                    id_counter += 1

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(quotes, f, ensure_ascii=False, indent=2)
    print(f"Successfully converted {len(quotes)} quotes to {json_path}")
else:
    print(f"File not found: {csv_path}")
