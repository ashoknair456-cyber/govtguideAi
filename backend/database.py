import os
import json
import uuid
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger("govguide.database")
logging.basicConfig(level=logging.INFO)

# File-based JSON Database - the app's only data store.
class JSONCollection:
    def __init__(self, name: str, file_path: str):
        self.name = name
        self.file_path = file_path
        
    def _read(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.file_path):
            return []
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get(self.name, [])
        except Exception as e:
            logger.error(f"Error reading JSON database: {e}")
            return []
            
    def _write(self, data: List[Dict[str, Any]]):
        os.makedirs(os.path.dirname(self.file_path), exist_ok=True)
        all_data = {}
        if os.path.exists(self.file_path):
            try:
                with open(self.file_path, 'r', encoding='utf-8') as f:
                    all_data = json.load(f)
            except Exception:
                all_data = {}
        all_data[self.name] = data
        try:
            with open(self.file_path, 'w', encoding='utf-8') as f:
                json.dump(all_data, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error writing to JSON database: {e}")

    def _match(self, item: Dict[str, Any], query: Dict[str, Any]) -> bool:
        if not query:
            return True
        for k, v in query.items():
            if k not in item:
                return False
            if isinstance(v, dict):
                # Basic operator support
                if "$in" in v:
                    val_list = v["$in"]
                    item_val = item[k]
                    # If item value is a list, check intersection
                    if isinstance(item_val, list):
                        if not any(x in val_list for x in item_val):
                            return False
                    elif item_val not in val_list:
                        return False
                elif "$ne" in v:
                    if item[k] == v["$ne"]:
                        return False
                elif "$eq" in v:
                    if item[k] != v["$eq"]:
                        return False
            else:
                # Direct match
                if str(item[k]).lower() != str(v).lower():
                    return False
        return True

    async def find_one(self, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        data = self._read()
        for item in data:
            if self._match(item, query):
                return item
        return None

    async def find(self, query: Dict[str, Any] = None) -> Any:
        query = query or {}
        data = self._read()
        matched = []
        for item in data:
            if self._match(item, query):
                matched.append(item)
        
        class Cursor:
            def __init__(self, items):
                self._items = list(items)
                self._skip_count = 0
                self._limit_count = None

            def skip(self, count: int):
                self._skip_count = max(0, count)
                return self

            def limit(self, count: int):
                self._limit_count = max(0, count)
                return self

            def sort(self, key_or_list, direction=1):
                try:
                    if isinstance(key_or_list, str):
                        reverse = (direction == -1)
                        self._items.sort(
                            key=lambda x: (x.get(key_or_list) is None, str(x.get(key_or_list, "")).lower()),
                            reverse=reverse
                        )
                except Exception:
                    pass
                return self

            async def to_list(self, length: Optional[int] = None):
                start = self._skip_count
                items = self._items[start:]
                effective_limit = length if length is not None else self._limit_count
                if effective_limit is not None:
                    return items[:effective_limit]
                return items
        return Cursor(matched)

    async def insert_one(self, document: Dict[str, Any]) -> Any:
        data = self._read()
        if "_id" not in document:
            document["_id"] = str(uuid.uuid4())
        data.append(document)
        self._write(data)
        
        class InsertResult:
            inserted_id = document["_id"]
        return InsertResult()

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any], upsert: bool = False) -> Any:
        data = self._read()
        found = False
        for idx, item in enumerate(data):
            if self._match(item, query):
                found = True
                if "$set" in update:
                    for k, v in update["$set"].items():
                        item[k] = v
                if "$push" in update:
                    for field, value in update["$push"].items():
                        if isinstance(value, dict) and "$each" in value:
                            item.setdefault(field, []).extend(value["$each"])
                        else:
                            item.setdefault(field, []).append(value)
                break
        if not found and upsert:
            new_item = query.copy()
            if "$set" in update:
                for k, v in update["$set"].items():
                    new_item[k] = v
            if "_id" not in new_item:
                new_item["_id"] = str(uuid.uuid4())
            data.append(new_item)
            
        self._write(data)
        class UpdateResult:
            matched_count = 1 if found else 0
            modified_count = 1 if found else 0
        return UpdateResult()

    async def delete_one(self, query: Dict[str, Any]) -> Any:
        data = self._read()
        new_data = []
        deleted = False
        for item in data:
            if self._match(item, query) and not deleted:
                deleted = True
                continue
            new_data.append(item)
        self._write(new_data)
        class DeleteResult:
            deleted_count = 1 if deleted else 0
        return DeleteResult()

    async def delete_many(self, query: Dict[str, Any]) -> Any:
        data = self._read()
        new_data = []
        deleted = 0
        for item in data:
            if self._match(item, query):
                deleted += 1
                continue
            new_data.append(item)
        self._write(new_data)
        class DeleteResult:
            deleted_count = deleted
        return DeleteResult()

    async def count_documents(self, query: Dict[str, Any]) -> int:
        data = self._read()
        count = 0
        for item in data:
            if self._match(item, query):
                count += 1
        return count

class JSONDatabase:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.collections = {}

    def __getitem__(self, name: str) -> JSONCollection:
        if name not in self.collections:
            self.collections[name] = JSONCollection(name, self.file_path)
        return self.collections[name]

# Database Selection Logic
# MongoDB has been removed: the app serves all data from the local JSON file
# (backend/data/local_db.json), which is bundled with the project.
JSON_DB_PATH = os.path.join(os.path.dirname(__file__), "data", "local_db.json")

db = JSONDatabase(JSON_DB_PATH)
is_mock_db = True  # Kept for backwards compatibility with existing imports.

def get_db():
    return db

