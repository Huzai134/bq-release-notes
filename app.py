import os
import urllib.request
import xml.etree.ElementTree as ET
import datetime
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache for feed data
_cache = {
    "data": None,
    "last_fetched": None
}

def parse_xml_feed(xml_content):
    try:
        root = ET.fromstring(xml_content)
    except Exception as e:
        print("XML parsing failed:", e)
        return []
    
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    entries = []
    
    for entry in root.findall('atom:entry', ns):
        title_elem = entry.find('atom:title', ns)
        updated_elem = entry.find('atom:updated', ns)
        link_elem = entry.find('atom:link', ns)
        content_elem = entry.find('atom:content', ns)
        id_elem = entry.find('atom:id', ns)
        
        title = title_elem.text if title_elem is not None else ""
        updated = updated_elem.text if updated_elem is not None else ""
        link = link_elem.attrib.get('href', "") if link_elem is not None else ""
        content = content_elem.text if content_elem is not None else ""
        entry_id = id_elem.text if id_elem is not None else ""
        
        entries.append({
            "title": title,
            "updated": updated,
            "link": link,
            "content": content,
            "id": entry_id
        })
    return entries

def fetch_feed(bypass_cache=False):
    global _cache
    now = datetime.datetime.now()
    
    # Check if cache is valid (say, for 10 minutes) and we are not bypassing it
    if not bypass_cache and _cache["data"] is not None:
        delta = now - _cache["last_fetched"]
        if delta.total_seconds() < 600: # 10 minutes
            return _cache["data"], _cache["last_fetched"].isoformat(), False
            
    try:
        req = urllib.request.Request(
            FEED_URL, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BQReleaseNotesViewer/1.0'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
            entries = parse_xml_feed(xml_data)
            _cache["data"] = entries
            _cache["last_fetched"] = now
            return entries, now.isoformat(), True
    except Exception as e:
        print("Error fetching feed:", e)
        # Fallback to cache if available
        if _cache["data"] is not None:
            return _cache["data"], _cache["last_fetched"].isoformat(), False
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    bypass_cache = request.args.get('refresh', 'false').lower() == 'true'
    try:
        entries, last_fetched, fetched_new = fetch_feed(bypass_cache)
        return jsonify({
            "success": True,
            "entries": entries,
            "last_fetched": last_fetched,
            "cached": not fetched_new
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
