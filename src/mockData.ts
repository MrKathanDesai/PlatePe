import { Category, Product, Table, User } from './types';

export const MOCK_USER: User = {
  id: 'u1',
  name: 'Kathan D.',
  email: 'kathan@platepe.com',
  role: 'Admin',
  active: true,
};

export const STAFF_MEMBERS: User[] = [
  {
    id: 's1',
    name: 'Aarav Mehta',
    email: 'aarav.mehta@aprilorigin.in',
    role: 'Admin',
    active: true,
  },
  {
    id: 's2',
    name: 'Naina Kulkarni',
    email: 'naina.kulkarni@aprilorigin.in',
    role: 'Cashier',
    active: true,
  },
  {
    id: 's3',
    name: 'Rohan Iyer',
    email: 'rohan.iyer@aprilorigin.in',
    role: 'Cashier',
    active: false,
  },
  {
    id: 's4',
    name: 'Ishita Kapoor',
    email: 'ishita.kapoor@aprilorigin.in',
    role: 'Admin',
    active: true,
  },
  {
    id: 's5',
    name: 'Devansh Patel',
    email: 'devansh.patel@aprilorigin.in',
    role: 'Cashier',
    active: false,
  },
  {
    id: 's6',
    name: 'Meera Nambiar',
    email: 'meera.nambiar@aprilorigin.in',
    role: 'Cashier',
    active: true,
  },
];

export const CATEGORIES: Category[] = [
  { id: 'c1', name: 'Coffee' },
  { id: 'c2', name: 'Food' },
  { id: 'c3', name: 'Desserts' },
  { id: 'c4', name: 'Cold Brew' },
  { id: 'c5', name: 'Teas' },
];

export const PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Cortado',
    categoryId: 'c1',
    price: 180,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB9xvFqVqxGCHxWG2MHRrN7xlq_ePFK7U0mIZ1AytEGZGKbXKXpC-qymBeQcpem7f11gzkqxm-nCxmheu-5vUucc2ZY5vCcT5cxHo3SxwvU6DH_qKFxEKzdM0Oxxg_15t9vwBqb0P5Z4I9qrvRmFvbRlAUSQcdYwueIYPpKmd9DfhPd1aNyV-TwZA4KItq1JI5nahE-THypLCS2Ija1y8xvrjp-yHlZhToaXk7a18NkYIcq9NsvfSo49rThjWyEsHUhq3IPfWPTqHAg',
    modifiers: [
      { id: 'm1', name: 'Oat Milk', price: 30 },
      { id: 'm2', name: 'Extra Hot', price: 0 },
    ],
  },
  {
    id: 'p2',
    name: 'Iced Latte',
    categoryId: 'c1',
    price: 240,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDg6KDIseMYE-TwdmVaSNejXKi2xZxRZpvzoy90akwJg7c2bkcR-OUYUB9vh1AgUbczE_WNcNdDjOujNWcj-3z6C23r2a5_sUPR2PbwNRnLkYuPem4bohV0FtLwwp6bZ1RPIRM0CVDwATS_OQg-aoWE9o9G4yeYRp9q4lyygVFdK4uJln-jATwqrflEEJJXFxoMDrZv8LQD4q6Q-Ame_BbRPaX7FLOFI2FESbAgdxugnME_dS6ZJ7rphDOn-NuwcHowqvIa4KINdB5Y',
  },
  {
    id: 'p3',
    name: 'Flat White',
    categoryId: 'c1',
    price: 210,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBVzLCxh5JSlszfGX1ZtUm9D0q3TaYW2hGiieanDZH9ZnFWCq-qMsF6796w-ZLk_f37k6QaX0WYmjDMQX5oB-IAGz1lcrmLLmU6Q345KCGtiK0n_w4H9X49JdeVmlb3gTrWUbnPzutLaJ06iAV78v8BDXUmWbXv7ZukMTH8OLlz6IRW3olecOeJrw77VG4Kln_drt8kCgj8BuNAD5AcFcKA9wOyCf4jS4J56cCxugGsSJCxx3H-6auPTmQU4ThBhkq-ZZz50flxqVkY',
  },
  {
    id: 'p4',
    name: 'Cappuccino',
    categoryId: 'c1',
    price: 195,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbJ7Y7QzRxmvhIpHEa91ATJOR8IlWhK58cWjrR_oKSLG-aFyjv978AqM-V0Sbp6xgybdpQrgBC4QgORu8S1sbyoB1aEJQ2YFa0YMckUQSRNPakEXIX4zFRiNvWWzkn9-2XD_DLSFTzj9x7HR-01-FtUFnB9jC13HRgO6Zxbxsh-EHVMqxFyGtcOarJTkzP7Z0te4eWTpJUJQHBRd0E7nhGXOtDT8zVDG2PzvMq03FYa3K5RnQ8N8f8ghQ-L4SofWmS-OKClKiBxPGz',
  },
  {
    id: 'p5',
    name: 'Dark Mocha',
    categoryId: 'c1',
    price: 260,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuARkdOCxFlT1gbKfqUUs7AUn8GAdHy5OOQu6DLf1ImMrS2A9YmeZ672XmDelvp6LfmUF59BTc1PxmG6v62n_dsZR7yy-dKeu5zP5lDFUzQVzrLMtGAzMgsD7OmexvepX1k7DNlj1E_C1p8GtG-WsHupy6QUr8CqFkcWY0hh-dIPQ7DWEJDOO4cssLTnRDUq-Ngy3uh0WJqpaFcOyaMBAitI7gTQ42FyYZVP4o_q11c_wUR8FVptFicWNAJd5yVvwM2lW8xJVIRSVtUz',
  },
  {
    id: 'p6',
    name: 'Nitro Brew',
    categoryId: 'c4',
    price: 280,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDY6WAC524tEUo4hpKBq-NLkUq9PkUQQVVsdqAzyPIRwC1aD54mlyPE1v8753AJ68CdJKqY2xXJ70hOKLcCArHCDLFmuXvacWLtZDxEs7mMDFe7bZU_E4arkZAN8N83Rvp3nNBZAjkADUiogEjYcfl3f8LE8wXoU4QZyu2L8nRFCkCGjlbN-cxky44HQGCHCN8PWbkFVFChNm9EhKbNMGLSKuzU0S9RodlGIm6g2Uhp5r38txE9iaCeeW38O37B4x2n-goUiOoZma_s',
  },
];

export const TABLES: Table[] = [
  { id: 't1', number: 'T1', seats: 4, status: 'Available' },
  { id: 't2', number: 'T2', seats: 2, status: 'Occupied', currentBill: 1450, occupiedTime: '45m' },
  { id: 't3', number: 'T3', seats: 6, status: 'Needs Attention', currentBill: 3820 },
  { id: 't4', number: 'T4', seats: 4, status: 'Available' },
  { id: 't5', number: 'T5', seats: 8, status: 'Occupied', currentBill: 7200, occupiedTime: '1h 12m' },
  { id: 't6', number: 'T6', seats: 4, status: 'Available' },
  { id: 't7', number: 'T7', seats: 4, status: 'Available' },
  { id: 't8', number: 'T8', seats: 4, status: 'Unpaid', currentBill: 450 },
  { id: 't9', number: 'T9', seats: 4, status: 'Available' },
  { id: 't10', number: 'T10', seats: 4, status: 'Available' },
];
