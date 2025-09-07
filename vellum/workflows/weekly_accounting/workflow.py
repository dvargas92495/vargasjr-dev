from vellum.workflows import BaseWorkflow
from .nodes import (
    BuildPersonalFinancialContext,
    GetCapitalOneTransactions,
    NormalizeFamilyTransactions,
    UpdateFinances,
    GetSummaryData,
    SummarizeData,
    SendFinancesReport,
)














class WeeklyAccountingWorkflow(BaseWorkflow):
    graph = {
        BuildPersonalFinancialContext
        >> GetCapitalOneTransactions
        >> NormalizeFamilyTransactions
        >> UpdateFinances
        >> GetSummaryData
        >> SummarizeData
        >> SendFinancesReport,
    }

    class Outputs(BaseWorkflow.Outputs):
        summary = SendFinancesReport.Outputs.summary
