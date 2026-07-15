from typing import Any, Protocol

from sqlalchemy import and_, or_, select

from app.db_ch.models import EntitySectionRelation
from app.models.domain.filters import BranchFilters


class Specification(Protocol):
    def to_expr(self, model: Any) -> Any | None: ...


class BranchFilterSpec(Specification):
    """部門・エンティティによるフィルタリング仕様"""

    def __init__(self, filters: BranchFilters | None, entity_relations: dict[str, dict[str, list[str]]] | None = None):
        self.filters = filters
        self.entity_relations = entity_relations

    def to_expr(self, model: Any) -> Any | None:
        if not self.filters or self.filters.is_empty:
            return None
        disj = []
        for cond in self.filters:
            conj = []
            entity = cond.entity_name
            dept = cond.dept_name
            section = cond.section_code
            product = getattr(cond, "product", None)

            if entity:
                # entityカラムを持つモデルでは直接フィルタし、他エンティティの混入を防ぐ
                if hasattr(model, "entity"):
                    conj.append(model.entity == entity)
                if self.entity_relations and entity in self.entity_relations:
                    depts = self.entity_relations[entity].get("depts", [])
                    sections = self.entity_relations[entity].get("sections", [])
                    conj.append(
                        or_(
                            model.dept_name.in_(depts),
                            model.section_code.in_(sections),
                            model.dept_name == entity,
                            model.section_code == entity,
                        )
                    )
                else:
                    dept_names = select(EntitySectionRelation.dept_name).where(EntitySectionRelation.entity == entity)
                    section_codes = select(EntitySectionRelation.section_code).where(EntitySectionRelation.entity == entity)
                    conj.append(
                        or_(
                            model.dept_name.in_(dept_names),
                            model.section_code.in_(section_codes),
                            model.dept_name == entity,
                            model.section_code == entity,
                        )
                    )
            if dept:
                conj.append(model.dept_name == dept)
            if section:
                conj.append(model.section_code == section)
            if product and hasattr(model, "product"):
                conj.append(model.product == product)

            if conj:
                disj.append(and_(*conj))
        return or_(*disj) if disj else None


class AddonBranchFilterSpec(Specification):
    """アドオンVaR集計用の部門フィルタリング仕様（二重計上防止のため親階層を展開しない）"""

    def __init__(self, filters: BranchFilters | None, entity_relations: dict[str, dict[str, list[str]]] | None = None):
        self.filters = filters
        self.entity_relations = entity_relations

    def to_expr(self, model: Any) -> Any | None:
        if not self.filters or self.filters.is_empty:
            return None
        disj = []
        for cond in self.filters:
            entity = cond.entity_name
            dept = cond.dept_name
            section = cond.section_code
            product = getattr(cond, "product", None)

            if product:
                # プロダクト指定がある場合、全体にかかるアドオンVaRは配賦できないため除外する
                continue

            if section:
                disj.append(model.section_code == section)
                continue
            if dept:
                disj.append(model.section_code == dept)
                continue
            if entity:
                if self.entity_relations and entity in self.entity_relations:
                    depts = self.entity_relations[entity].get("depts", [])
                    disj.append(model.section_code.in_(depts))
                else:
                    dept_names = select(EntitySectionRelation.dept_name).where(EntitySectionRelation.entity == entity).distinct()
                    disj.append(model.section_code.in_(dept_names))

        return or_(*disj) if disj else None


class PreferImportedDataSpec(Specification):
    """日報データ(imported_datetime)を優先して表示するかどうかの仕様"""

    def __init__(self, prefer_imported: bool, excluded_keys: list[tuple[str, str, str, str]]):
        self.prefer_imported = prefer_imported
        self.excluded_keys = excluded_keys

    def to_expr(self, model: Any) -> Any | None:
        if not self.prefer_imported:
            return model.imported_datetime.is_(None)

        if not self.excluded_keys:
            return None

        disj = []
        for section_code, factor_id, dept_name, product in sorted(self.excluded_keys):
            disj.append(
                and_(
                    model.section_code == section_code,
                    model.factor_id == factor_id,
                    model.dept_name == dept_name,
                    model.product == product,
                )
            )
        return or_(
            and_(
                model.imported_datetime.is_(None),
                ~or_(*disj),
            ),
            model.imported_datetime.isnot(None),
        )
