from collections.abc import Sequence
from typing import Any

from sqlalchemy.orm import Session


class BaseRepository:
    """DBアクセスの定型処理を共通化する基底リポジトリ"""

    def __init__(self, session: Session):
        self.session = session

    def fetch_all(self, stmt: Any) -> Sequence[Any]:
        return self.session.execute(stmt).all()

    def fetch_first(self, stmt: Any) -> Any | None:
        return self.session.execute(stmt).first()

    def fetch_scalar(self, stmt: Any) -> Any | None:
        return self.session.execute(stmt).scalar()

    def fetch_entity_relations(self) -> dict[str, dict[str, list[str]]]:
        from app.db_ch.models import EntitySectionRelation
        from sqlalchemy import select

        stmt = select(EntitySectionRelation.entity, EntitySectionRelation.dept_name, EntitySectionRelation.section_code)
        rows = self.fetch_all(stmt)
        relations = {}
        for entity, dept_name, section_code in rows:
            if entity not in relations:
                relations[entity] = {"depts": [], "sections": []}
            if dept_name and dept_name not in relations[entity]["depts"]:
                relations[entity]["depts"].append(dept_name)
            if section_code and section_code not in relations[entity]["sections"]:
                relations[entity]["sections"].append(section_code)
        return relations
