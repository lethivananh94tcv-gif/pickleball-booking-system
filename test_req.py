import urllib.request
import json

req = urllib.request.Request(
    'http://127.0.0.1:8000/api/ai/analyze-intent',
    data=json.dumps({'message': 'Kiểm tra sân trống'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
try:
    res = urllib.request.urlopen(req)
    with open('test_out.json', 'w', encoding='utf-8') as f:
        f.write(res.read().decode('utf-8'))
except Exception as e:
    with open('test_out.json', 'w', encoding='utf-8') as f:
        f.write(str(e))
