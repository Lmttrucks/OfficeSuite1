import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LinkInvoiceGenForm from '../../../components/invoice/linkinvoicing/LinkInvoiceGenForm';
import LinkInvoicePreviewForm from '../../../components/invoice/linkinvoicing/LinkInvoicePreviewForm';
import LinkInvoicePreviewTable from '../../../components/invoice/linkinvoicing/LinkInvoicePreviewTable';
import InvoicePDFViewer from '../../../components/invoice/InvoicePDFViewer';
import axios from 'axios';
import config from '../../../config';

const LinkInvoicePage = () => {
  const location = useLocation();
  const { previewData, formData } = location.state || {
    previewData: [],
    formData: {}
  };
  const [invoiceData, setInvoiceData] = useState({ ...formData, previewData });
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (formData && Object.keys(formData).length > 0) {
      setInvoiceData(formData);
      setStep(2);
    }
  }, [formData]);

  const handleFormUpdate = (newData) => {
    setInvoiceData((prevData) => ({ ...prevData, ...newData }));
    setStep(2);
  };

  const handlePreview = async (updatedFormData) => {
    try {
      const response = await axios.post(
        `${config.apiBaseUrl}/invoices/previewLinkedLoadsInvoice`,
        {
          CompanyName: updatedFormData.companyName,
          StartDate: updatedFormData.startDate,
          EndDate: updatedFormData.endDate,
          Purchase: updatedFormData.purchase // Include Purchase in the request
        },
        config.getAuthHeaders()
      );

      const loads = response.data;
      setInvoiceData((prevData) => ({ ...prevData, loads }));
      setStep(2);
    } catch (error) {
      console.error('Failed to preview linked loads invoice', error);
      alert('Failed to preview linked loads invoice');
    }
  };

  const handleGenerate = async () => {
    try {
      const updatedInvoiceData = {
        ...invoiceData,
        loadCount: invoiceData.loads?.length || 0,
        paymentAmount:
          (invoiceData.loads || []).reduce(
            (acc, row) => acc + row.Rate * row.UnitQuantity,
            0
          ) *
          (1 + (invoiceData.vatRate || 0) / 100)
      };

      const response = await axios.post(
        `${config.apiBaseUrl}/invoices/insertInvoice`,
        {
          CompanyID: updatedInvoiceData.companyID,
          StartDate: updatedInvoiceData.startDate,
          EndDate: updatedInvoiceData.endDate,
          VatRate: updatedInvoiceData.vatRate,
          LoadCount: updatedInvoiceData.loadCount,
          PaymentAmount: updatedInvoiceData.paymentAmount,
          UserID: localStorage.getItem('userID'),
          Purchase: updatedInvoiceData.purchase // Include Purchase in the request
        },
        config.getAuthHeaders()
      );

      const invoiceNo = response.data.outvoiceNo;
      setInvoiceData((prevData) => ({ ...prevData, invoiceNo }));

      await Promise.all(
        (updatedInvoiceData.loads || []).map((load) => {
          const id = parseInt(load.ID, 10);
          const invoiceNoInt = parseInt(invoiceNo, 10);

          return axios.put(
            `${config.apiBaseUrl}/loads/updateLinkLoad/`,
            { id, invoiceNo: invoiceNoInt },
            config.getAuthHeaders()
          );
        })
      );

      const finalInvoiceData = {
        ...updatedInvoiceData,
        invoiceNo
      };
      setInvoiceData(finalInvoiceData);
      setStep(3);
    } catch (error) {
      console.error('Failed to generate invoice', error);
      alert('Failed to generate invoice');
    }
  };

  console.log('Invoice Data:', invoiceData); // Add this line

  return (
    <div>
      {step === 1 ? (
        <LinkInvoiceGenForm
          initialData={invoiceData}
          onFormUpdate={handleFormUpdate}
          onPreview={handlePreview}
        />
      ) : step === 2 ? (
        <>
          <LinkInvoicePreviewForm
            previewData={invoiceData.loads}
            formData={invoiceData}
            onFormUpdate={handleFormUpdate}
            onGenerate={handleGenerate}
          />
          <LinkInvoicePreviewTable data={invoiceData.loads} />
        </>
      ) : (
       <InvoicePDFViewer invoiceData={invoiceData} />
      )}
    </div>
  );
};

export default LinkInvoicePage;